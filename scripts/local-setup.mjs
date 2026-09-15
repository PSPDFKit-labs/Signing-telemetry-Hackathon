import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CreateBucketCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

if (!existsSync('.env.local')) {
  const values = {
    LOCAL_DEMO: 'true',
    LOCAL_DEMO_PASSWORD: randomBytes(32).toString('hex'),
    AUTH_SECRET: randomBytes(32).toString('hex'),
    AUTH_TRUST_HOST: 'true',
    DATABASE_URL: 'postgresql://resident_demo:local-development-only@127.0.0.1:54329/resident_demo',
    DATABASE_TYPE: 'postgres',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3000',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'resident-local',
    AWS_SECRET_ACCESS_KEY: 'local-development-only',
    AWS_S3_BUCKET_NAME: 'resident-demo',
    S3_ENDPOINT: 'http://127.0.0.1:19000',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1025',
    EMAIL_FROM: 'Resident Interface Evaluation <evaluation@resident-demo.test>',
    LOCAL_MAILBOX_URL: 'http://127.0.0.1:8025',
  };
  writeFileSync(
    '.env.local',
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  console.log('Created private local configuration. Existing environment files are never overwritten.');
}
config({ path: '.env.local', quiet: true });
if (process.env.LOCAL_DEMO !== 'true' || process.env.S3_ENDPOINT !== 'http://127.0.0.1:19000') {
  throw new Error('This command initializes only the local demo storage. Existing configuration was preserved.');
}
const localMailDefaults = {
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  EMAIL_FROM: 'Resident Interface Evaluation <evaluation@resident-demo.test>',
  LOCAL_MAILBOX_URL: 'http://127.0.0.1:8025',
};
const missingMailConfig = Object.entries(localMailDefaults).filter(([key]) => !process.env[key]);
if (missingMailConfig.length > 0) {
  appendFileSync('.env.local', `${missingMailConfig.map(([key, value]) => `${key}=${value}`).join('\n')}\n`, {
    mode: 0o600,
  });
  for (const [key, value] of missingMailConfig) process.env[key] = value;
  console.log('Configured the private local email inbox. Messages remain on this machine.');
}
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
});
try {
  await s3.send(new HeadBucketCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME }));
} catch (error) {
  if (error.$metadata?.httpStatusCode !== 404) throw error;
  await s3.send(new CreateBucketCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME }));
}
// Upload built-in PDFs before the app accepts a request. The database seed is
// still responsible for template records; this prevents an existing record
// from pointing to an absent local object.
const systemTemplates = [
  ['blank', 'blank.pdf'],
  ['contract', 'contract.pdf'],
  ['nda', 'nda.pdf'],
  ['offer-letter', 'offer-letter.pdf'],
  ['w4', 'w4.pdf'],
];
let restored = 0;
for (const [slug, file] of systemTemplates) {
  const key = `system-templates/${slug}.pdf`;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }));
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 404) throw error;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: readFileSync(`templates/pdf/${file}`),
        ContentType: 'application/pdf',
      }),
    );
    restored++;
  }
}
console.log(`Local document storage is ready${restored ? ` (${restored} template file${restored === 1 ? '' : 's'} restored)` : ''}.`);
