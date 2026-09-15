import { defineConfig } from 'drizzle-kit';
import config from '@/lib/config';

export default defineConfig({
  dialect: 'postgresql',
  schema: 'database/database.schema.ts',
  out: 'database/migrations/',
  dbCredentials: {
    url: config.database.url as string,
  },
  verbose: true,
  strict: true,
});
