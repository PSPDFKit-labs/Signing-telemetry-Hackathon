import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);

console.log('\n⚠️  DATABASE RESET SCRIPT ⚠️\n');
console.log('This will DELETE ALL document-related data but keep user accounts.\n');

try {
  console.log('Starting database cleanup...\n');

  // Delete in correct order (child tables first due to foreign keys)
  console.log('1. Deleting document notifications...');
  await sql`DELETE FROM document_notifications`;

  console.log('2. Deleting audit log entries...');
  await sql`DELETE FROM document_audit_log`;

  console.log('3. Deleting document annotations...');
  await sql`DELETE FROM document_annotations`;

  console.log('4. Deleting signature requests...');
  await sql`DELETE FROM signature_requests`;

  console.log('5. Deleting document participants...');
  await sql`DELETE FROM document_participants`;

  console.log('6. Deleting documents...');
  await sql`DELETE FROM documents`;

  console.log('7. Deleting document templates...');
  await sql`DELETE FROM document_templates`;

  console.log('\n✅ Database reset complete!\n');
  console.log('All document data has been removed.');
  console.log('User accounts have been preserved.\n');
  console.log('You can now start testing with a clean slate.\n');
} catch (error) {
  console.error('\n❌ Error resetting database:', error);
  process.exit(1);
} finally {
  await sql.end();
}
