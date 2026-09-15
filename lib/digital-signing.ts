import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { and, eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import {
  documentAnnotations,
  documentAuditLog,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { requiresDigitalSeal } from '@/lib/finalization-policy';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function storageKey(filePath: string): string {
  if (!filePath.startsWith('http')) return filePath.replace(/^\/+/, '');
  return decodeURIComponent(new URL(filePath).pathname.replace(/^\/+/, ''));
}

function sha256(bytes: Uint8Array | ArrayBuffer): string {
  const buffer =
    bytes instanceof Uint8Array
      ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : Buffer.from(new Uint8Array(bytes));
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Rebuilds the final PDF from the canonical S3 object and server-approved
 * InstantJSON, flattens it, and optionally applies the DWS digital seal selected
 * by the sender. Browser-provided final PDF bytes are never trusted.
 */
export async function finalizeDocument(
  instantJSON: Record<string, unknown>,
  documentId: string,
): Promise<ArrayBuffer | null> {
  const apiKey = process.env.NUTRIENT_API_KEY;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const rawBaseUrl = process.env.NUTRIENT_API_BASE_URL || 'https://api.nutrient.io/';
  const apiBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;
  if (!apiKey || !bucketName) {
    logger.error('Document finalization is not configured', { documentId });
    return null;
  }

  try {
    const document = await db.query.documents.findFirst({ where: (documents, { eq }) => eq(documents.id, documentId) });
    if (document?.status !== 'IN_PROGRESS') {
      logger.warn('Skipping finalization for a document that is not awaiting finalization', { documentId });
      return null;
    }
    const shouldSeal = requiresDigitalSeal(document.finalizationMode);

    const source = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: storageKey(document.documentFilePath) }),
    );
    const sourceBytes = await source.Body?.transformToByteArray();
    if (!sourceBytes) throw new Error('Canonical document could not be read from storage');

    const buildFormData = new FormData();
    buildFormData.append(
      'document',
      new Blob([exactArrayBuffer(sourceBytes)], { type: 'application/pdf' }),
      `${documentId}.pdf`,
    );
    buildFormData.append(
      'annotations.json',
      new Blob([JSON.stringify(instantJSON)], { type: 'application/json' }),
      'annotations.json',
    );
    buildFormData.append(
      'instructions',
      JSON.stringify({
        parts: shouldSeal ? [{ file: 'document' }, { page: 'new', pageCount: 1 }] : [{ file: 'document' }],
        actions: [{ type: 'applyInstantJson', file: 'annotations.json' }, { type: 'flatten' }],
      }),
    );

    const buildResponse = await fetch(`${apiBaseUrl}build`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: buildFormData,
    });
    if (!buildResponse.ok) throw new Error(`DWS build failed (${buildResponse.status}): ${await buildResponse.text()}`);

    const builtPdfBuffer = await buildResponse.arrayBuffer();
    let finalPdfBuffer = builtPdfBuffer;
    let digitalSignatureHash: string | null = null;

    if (shouldSeal) {
      const builtPdf = await PDFDocument.load(builtPdfBuffer, { updateMetadata: false });
      const signaturePageIndex = builtPdf.getPageCount() - 1;
      if (signaturePageIndex < 0) throw new Error('DWS build produced a document with no pages');

      const logoPath = path.join(process.cwd(), 'public', 'nutrient-logo-symbol-transparent.png');
      const signFormData = new FormData();
      signFormData.append('file', new Blob([builtPdfBuffer], { type: 'application/pdf' }), `${documentId}.pdf`);
      signFormData.append('image', new Blob([fs.readFileSync(logoPath)], { type: 'image/png' }), 'nutrient-logo.png');
      signFormData.append(
        'data',
        JSON.stringify({
          signatureType: 'cades',
          cadesLevel: 'b-lt',
          appearance: {
            mode: 'descriptionOnly',
            contentType: 'image/png',
            showSigner: true,
            showSignDate: true,
            showDateTimezone: true,
            showWatermark: true,
            showReason: false,
            showLocation: false,
          },
          position: { pageIndex: signaturePageIndex, rect: [156, 316, 300, 160] },
          signatureMetadata: { signerName: 'Nutrient' },
        }),
      );

      const signResponse = await fetch(`${apiBaseUrl}sign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: signFormData,
      });
      if (!signResponse.ok) throw new Error(`DWS sign failed (${signResponse.status}): ${await signResponse.text()}`);
      finalPdfBuffer = await signResponse.arrayBuffer();
      digitalSignatureHash = sha256(finalPdfBuffer);
    }

    const finalHash = sha256(finalPdfBuffer);
    const s3Key = `${shouldSeal ? 'signed' : 'completed'}/${documentId}/${finalHash}.pdf`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: Buffer.from(finalPdfBuffer),
        ContentType: 'application/pdf',
      }),
    );
    const signedDocumentFilePath = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    const finalized = await db.transaction(async (tx) => {
      const updated = await tx
        .update(documents)
        .set({
          status: 'COMPLETED',
          signedDocumentFilePath,
          documentFileHash: document.documentFileHash || sha256(sourceBytes),
          updatedAt: new Date(),
        })
        .where(and(eq(documents.id, documentId), eq(documents.status, 'IN_PROGRESS')))
        .returning();
      if (updated.length === 0) return false;

      await tx
        .update(signatureRequests)
        .set({ digitalSignatureHash })
        .where(eq(signatureRequests.documentId, documentId));
      await tx
        .update(documentAnnotations)
        .set({ isFinalized: true })
        .where(eq(documentAnnotations.documentId, documentId));
      await tx.insert(documentAuditLog).values({
        id: crypto.randomUUID(),
        documentId,
        action: 'DOCUMENT_FINALIZED',
        details: {
          finalHash,
          signedDocumentFilePath,
          finalizationMode: document.finalizationMode,
          digitalSealApplied: shouldSeal,
          digitalSignatureHash,
        },
        createdAt: new Date(),
      });
      return true;
    });
    if (!finalized) return null;

    logger.info('Document finalized', { documentId, finalHash, digitalSealApplied: shouldSeal });
    return finalPdfBuffer;
  } catch (error) {
    logger.error('Failed to finalize document', error, { documentId });
    await db
      .insert(documentAuditLog)
      .values({
        id: crypto.randomUUID(),
        documentId,
        action: 'DOCUMENT_FINALIZATION_FAILED',
        details: { message: error instanceof Error ? error.message : 'Unknown finalization error' },
        createdAt: new Date(),
      })
      .catch((auditError) => logger.error('Failed to record finalization failure', auditError, { documentId }));
    return null;
  }
}
