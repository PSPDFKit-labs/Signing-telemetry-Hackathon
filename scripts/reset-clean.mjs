import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

const bucketName = process.env.AWS_S3_BUCKET_NAME;
const sql = postgres(process.env.DATABASE_URL);

console.log('\n⚠️  FULL RESET: S3 + DATABASE ⚠️\n');
console.log('This will DELETE all S3 objects and all document-related data.\n');

try {
  // 1. Empty S3 bucket
  console.log(`1. Emptying S3 bucket: ${bucketName}...`);
  try {
    const output = execFileSync('aws', ['s3', 'rm', `s3://${bucketName}/`, '--recursive'], {
      encoding: 'utf-8',
    });
    if (output.trim()) console.log(output.trim());
    console.log('   S3 bucket emptied.\n');
  } catch {
    console.warn('   Warning: S3 cleanup failed (bucket may already be empty).\n');
  }

  // 2. Reset database (child tables first due to foreign keys)
  console.log('2. Resetting database...');

  const tables = [
    'document_notifications',
    'document_audit_log',
    'document_annotations',
    'signature_requests',
    'document_participants',
    'documents',
    'document_templates',
  ];

  for (const table of tables) {
    await sql`DELETE FROM ${sql(table)}`;
    console.log(`   Cleared ${table}`);
  }

  console.log('\n✅ Full reset complete!\n');
  console.log('Restart the dev server to re-seed system templates.\n');
} catch (error) {
  console.error('\n❌ Error during reset:', error);
  process.exit(1);
} finally {
  await sql.end();
}
