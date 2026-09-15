import { neon } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import { migrate as neonMigrate } from 'drizzle-orm/neon-http/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate as postgresMigrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './database.schema';

const runMigrate = async () => {
  console.log('Running migrations...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  const connectionString = process.env.DATABASE_URL;
  const databaseType = process.env.DATABASE_TYPE || 'postgres';

  console.log(`Database type: ${databaseType}`);
  console.log(`Using connection string: ${connectionString}`);
  console.log('Running migrations...');

  try {
    if (databaseType === 'neon') {
      // Neon serverless connection
      const sql = neon(connectionString);
      const db = neonDrizzle(sql, { schema });
      await neonMigrate(db, { migrationsFolder: 'drizzle/migrations' });
    } else {
      // AWS RDS connection
      const sql = postgres(connectionString, {
        max: 1,
      });

      const db = drizzle(sql, { schema });
      await postgresMigrate(db, { migrationsFolder: 'drizzle/migrations' });

      // Important: close the connection after migration
      await sql.end();
    }

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed', error);
    process.exit(1);
  }
};

const main = async () => {
  await runMigrate();
};

main();

export default main;
