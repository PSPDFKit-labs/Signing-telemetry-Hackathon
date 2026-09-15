import { defineConfig } from 'drizzle-kit';
import config from '@/lib/config';

export default defineConfig({
  dialect: 'postgresql',
  schema: 'database/drizzle/database.schema.ts',
  out: 'database/drizzle/migrations/',
  dbCredentials: {
    url: config.database.url as string,
  },
  verbose: true,
  strict: true,
});
