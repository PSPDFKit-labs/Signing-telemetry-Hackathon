import { neon } from '@neondatabase/serverless';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './database.schema';

type Database = PostgresJsDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;
type DatabaseType = 'neon' | 'postgres';
type DatabaseConfig = {
  DATABASE_URL: string;
  DATABASE_TYPE: DatabaseType;
};

const MISSING_DATABASE_MESSAGE = 'DATABASE_URL environment variable is not set';

const POOL_CONFIG = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const validateConfig = (): DatabaseConfig => {
  const url = process.env.DATABASE_URL;
  const type = process.env.DATABASE_TYPE as DatabaseType;

  if (!url) throw new Error(MISSING_DATABASE_MESSAGE);

  if (type && type !== 'neon' && type !== 'postgres') {
    throw new Error('DATABASE must be either "neon" or "postgres"');
  }

  return {
    DATABASE_URL: url,
    DATABASE_TYPE: type || 'postgres', // Default to postgres if not specified
  };
};

function createDatabase(): Database {
  if (!process.env.DATABASE_URL) {
    // Route modules are evaluated while Next.js collects build metadata. Keep
    // that phase database-independent, but fail clearly if runtime code tries
    // to execute a query without configuration.
    return new Proxy({} as Database, {
      get() {
        throw new Error(MISSING_DATABASE_MESSAGE);
      },
    });
  }
  const config = validateConfig();

  if (config.DATABASE_TYPE === 'neon') {
    const sql = neon(config.DATABASE_URL);
    return neonDrizzle(sql, { schema });
  }

  const pool = postgres(config.DATABASE_URL, POOL_CONFIG);
  return drizzle(pool, { schema });
}

const db = createDatabase();

export { db };
