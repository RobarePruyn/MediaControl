/**
 * Drizzle Kit configuration for database migrations.
 * @module api-server/drizzle.config
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://suitecommand:suitecommand@localhost:5432/suitecommand',
  },
});
