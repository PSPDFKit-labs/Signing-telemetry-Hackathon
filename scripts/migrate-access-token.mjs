/**
 * Migration script to add accessToken column to signature_requests table
 * Run with: node scripts/migrate-access-token.mjs
 */

import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function migrate() {
  console.log('🔄 Running migration: Add access_token to signature_requests...\n');

  try {
    // Add column
    await sql`
      ALTER TABLE signature_requests
      ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;
    `;
    console.log('✅ Added access_token column');

    // Add index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_signature_requests_access_token
      ON signature_requests(access_token);
    `;
    console.log('✅ Created index on access_token');

    // Update existing rows
    const result = await sql`
      UPDATE signature_requests
      SET access_token = gen_random_uuid()::text
      WHERE access_token IS NULL;
    `;
    console.log(`✅ Updated existing rows: ${result.count || 0} records`);

    console.log('\n🎉 Migration completed successfully!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

migrate();
