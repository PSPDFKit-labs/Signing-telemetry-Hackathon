import { GetObjectCommand } from '@aws-sdk/client-s3';
import { and, eq, like, or } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import {
  documentParticipants,
  documents,
  documentTemplates,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { isDocumentExpired } from '@/lib/document-expiration';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';
import { tokenLookupCandidates } from '@/lib/signing-tokens';

/** Escape SQL LIKE wildcards in user input */
function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

function storageKey(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (!filePath.startsWith('http')) return filePath.replace(/^\/+/, '');
  return decodeURIComponent(new URL(filePath).pathname.replace(/^\/+/, ''));
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    let documentKey = searchParams.get('key');
    const useProxy = searchParams.get('proxy') === 'true';
    const signingToken = searchParams.get('signingToken');
    const documentId = searchParams.get('documentId');
    const templateId = searchParams.get('templateId');

    if (!documentKey) {
      return NextResponse.json({ error: 'Document key is required' }, { status: 400 });
    }

    // Fix double-encoding issue if present
    documentKey = decodeURIComponent(documentKey);

    let document: typeof documents.$inferSelect | undefined;
    let hasAccess = false;

    if (signingToken) {
      // Signing token path: look up the document directly via the signing token.
      // This is more reliable than the LIKE query because multiple documents can share
      // the same file path (same PDF re-uploaded), causing the LIKE query to return
      // the wrong document and fail the token check.
      const [hashedToken, legacyToken] = tokenLookupCandidates(signingToken);
      const tokenResult = await db
        .select({ doc: documents, signingRequest: signatureRequests })
        .from(signatureRequests)
        .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
        .where(or(eq(signatureRequests.accessToken, hashedToken), eq(signatureRequests.accessToken, legacyToken)))
        .limit(1);

      if (tokenResult.length > 0) {
        const { doc: tokenDoc, signingRequest } = tokenResult[0];
        // Verify this token grants access to the requested file
        const tokenIsActive = signingRequest.status === 'PENDING' || signingRequest.status === 'SIGNED';
        const documentIsActive =
          !tokenDoc.deletedAt &&
          tokenDoc.status !== 'CANCELLED' &&
          tokenDoc.status !== 'DECLINED' &&
          !isDocumentExpired(tokenDoc.expiresAt);
        if (tokenIsActive && documentIsActive && storageKey(tokenDoc.documentFilePath) === documentKey) {
          document = tokenDoc;
          hasAccess = true;
        }
      }
    } else if (templateId) {
      // Template path: when templateId is provided, go directly to template lookup
      // (skip document LIKE query which can match documents created from the same template file)
      if (session?.user?.id) {
        const templateResults = await db
          .select()
          .from(documentTemplates)
          .where(eq(documentTemplates.id, templateId))
          .limit(1);

        if (templateResults.length > 0) {
          const template = templateResults[0];
          if (template.creatorId === session.user.id || template.isSystem) {
            hasAccess = true;
            document = { documentFilePath: template.templateFilePath } as typeof documents.$inferSelect;
          }
        }
      }

      if (!hasAccess) {
        return new Response('Template not found', { status: 404 });
      }
    } else {
      // Authenticated path: find document by ID (preferred) or file path (legacy fallback)
      const documentResults = documentId
        ? await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
        : await db
            .select()
            .from(documents)
            .where(
              or(
                like(documents.documentFilePath, `%${escapeLikePattern(documentKey)}`),
                like(documents.signedDocumentFilePath, `%${escapeLikePattern(documentKey)}`),
              ),
            )
            .limit(1);

      if (documentResults.length === 0) {
        // Fallback: check if this is a template file
        if (session?.user?.id) {
          const templateResults = await db
            .select()
            .from(documentTemplates)
            .where(like(documentTemplates.templateFilePath, `%${escapeLikePattern(documentKey)}`))
            .limit(1);

          if (templateResults.length > 0) {
            const template = templateResults[0];
            // Grant access if user is creator or template is system
            if (template.creatorId === session.user.id || template.isSystem) {
              hasAccess = true;
              // Create a minimal document-like object for the S3 fetch below
              document = { documentFilePath: template.templateFilePath } as typeof documents.$inferSelect;
            }
          }
        }

        if (!hasAccess) {
          return new Response('Document not found', { status: 404 });
        }
      } else {
        document = documentResults[0];

        if (session?.user?.id) {
          if (document.ownerId === session.user.id) {
            hasAccess = true;
          } else {
            const participantResults = await db
              .select()
              .from(documentParticipants)
              .where(
                and(eq(documentParticipants.documentId, document.id), eq(documentParticipants.userId, session.user.id)),
              )
              .limit(1);
            hasAccess = participantResults.length > 0;
          }
        }
      }
    }

    if (!hasAccess || !document) {
      return new Response(session?.user?.id ? 'Forbidden - Access denied' : 'Unauthorized', {
        status: session?.user?.id ? 403 : 401,
      });
    }

    const allowedKeys = [storageKey(document.documentFilePath), storageKey(document.signedDocumentFilePath)].filter(
      (key): key is string => Boolean(key),
    );
    if (!allowedKeys.includes(documentKey)) {
      return new Response('Forbidden - File does not belong to this document', { status: 403 });
    }

    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    // Create a GetObject command
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: documentKey,
    });

    // If proxy is not requested, generate a pre-signed URL
    if (!useProxy) {
      // Import getSignedUrl dynamically to avoid server component issues
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      // Generate a pre-signed URL valid for 1 hour
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return NextResponse.json({ url: signedUrl });
    }

    // Otherwise, stream the file through our server
    try {
      const response = await s3Client.send(command);

      // Get the binary data
      const bodyContents = await response.Body?.transformToByteArray();

      if (!bodyContents) {
        console.error('No content returned from S3');
        return NextResponse.json({ error: 'Failed to read document contents' }, { status: 500 });
      }

      // Create response with appropriate content type
      const contentType = response.ContentType || 'application/octet-stream';
      // Create a new Response with the file content
      return new Response(bodyContents.buffer as ArrayBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': 'inline',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (s3Error: unknown) {
      logger.error('S3 error retrieving document', s3Error);
      return NextResponse.json(
        {
          error: 'Error retrieving document from storage',
        },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    logger.error('Error processing document request', error);
    return NextResponse.json(
      {
        error: 'Error retrieving document',
      },
      { status: 500 },
    );
  }
}
