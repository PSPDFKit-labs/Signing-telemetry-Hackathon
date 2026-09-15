#!/usr/bin/env node
import { config } from 'dotenv';
import postgres from 'postgres';

// Load environment variables
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function addCancelledStatus() {
  try {
    console.log('Adding CANCELLED status to enums...');

    // Add CANCELLED to signature_status enum
    try {
      await sql`ALTER TYPE "signature_status" ADD VALUE IF NOT EXISTS 'CANCELLED'`;
      console.log('✓ Added CANCELLED to signature_status enum');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('✓ CANCELLED already exists in signature_status enum');
      } else {
        throw error;
      }
    }

    // Add CANCELLED to document_status enum
    try {
      await sql`ALTER TYPE "document_status" ADD VALUE IF NOT EXISTS 'CANCELLED'`;
      console.log('✓ Added CANCELLED to document_status enum');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('✓ CANCELLED already exists in document_status enum');
      } else {
        throw error;
      }
    }

    console.log('\n✓ Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

addCancelledStatus();
