/**
 * Migration script to add accessToken column to signature_requests table
 * Run with: npx tsx scripts/migrate-access-token.ts
 */

import * as dotenv from 'dotenv';

// Load environment variables BEFORE importing db
dotenv.config({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { db } from '../database/drizzle/drizzle';

async function migrate() {
  console.log('🔄 Running migration: Add access_token to signature_requests...\n');

  try {
    // Add column
    await db.execute(sql`
      ALTER TABLE signature_requests
      ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;
    `);
    console.log('✅ Added access_token column');

    // Add index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_signature_requests_access_token
      ON signature_requests(access_token);
    `);
    console.log('✅ Created index on access_token');

    // Do not mint database-readable bearer credentials for old requests.
    // Owners can use the resend action to issue hashed tokens safely.
    console.log('✅ Existing requests left without tokens; resend them to issue secure links');

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
