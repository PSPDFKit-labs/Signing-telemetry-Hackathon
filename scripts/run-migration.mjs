#!/usr/bin/env node
import { readFileSync } from 'node:fs';
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

async function runMigration() {
  try {
    console.log('Running migration...');

    const migrationSQL = readFileSync('database/drizzle/migrations/0001_special_inhumans.sql', 'utf8');

    // Split by statement breakpoint
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      console.log('Executing:', `${statement.substring(0, 100)}...`);
      await sql.unsafe(statement);
    }

    console.log('✓ Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
