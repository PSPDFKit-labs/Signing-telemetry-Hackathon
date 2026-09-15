import fs from 'node:fs';
import path from 'node:path';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { documentTemplates } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { s3Client } from '@/lib/s3';

const SYSTEM_TEMPLATES = [
  { slug: 'blank', name: 'Blank Document', file: 'blank.pdf' },
  { slug: 'contract', name: 'Service Agreement', file: 'contract.pdf' },
  { slug: 'nda', name: 'Non-Disclosure Agreement', file: 'nda.pdf' },
  { slug: 'offer-letter', name: 'Employment Offer Letter', file: 'offer-letter.pdf' },
  { slug: 'w4', name: 'W-4 Employee Withholding Certificate', file: 'w4.pdf' },
];

export async function seedSystemTemplates() {
  // Check which system templates already exist (per-template idempotency)
  const existingRows = await db
    .select({ filePath: documentTemplates.templateFilePath })
    .from(documentTemplates)
    .where(eq(documentTemplates.isSystem, true));

  const existingKeys = new Set(existingRows.map((r) => r.filePath));

  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';
  const pdfDir = path.join(process.cwd(), 'templates', 'pdf');

  let seededCount = 0;

  for (const template of SYSTEM_TEMPLATES) {
    const s3Key = `system-templates/${template.slug}.pdf`;
    const templateFilePath = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

    const filePath = path.join(pdfDir, template.file);

    if (!fs.existsSync(filePath)) {
      console.warn(`  Skipping ${template.name}: PDF not found at ${filePath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    let objectExists = false;
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: s3Key }));
      objectExists = true;
    } catch (error: unknown) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status && status !== 404) throw error;
    }

    if (!objectExists) {
      if (seededCount === 0) console.log('Seeding system template files...');
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: 'application/pdf',
        }),
      );
      console.log(`  Uploaded: ${template.name}`);
      seededCount++;
    }

    if (!existingKeys.has(templateFilePath)) {
      await db.insert(documentTemplates).values({
        id: crypto.randomUUID(),
        name: template.name,
        creatorId: null,
        isSystem: true,
        templateFilePath,
        size: fileBuffer.length,
        createdAt: new Date(),
      });
      console.log(`  Added: ${template.name}`);
    }
  }

  if (seededCount > 0) {
    console.log(`System template files ready (${seededCount} uploaded).`);
  }
}
