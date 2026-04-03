/**
 * Drizzle ORM client instance for the SuiteCommand database.
 * Provides the configured database connection used throughout the api-server.
 * @module api-server/db/client
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

const { Pool } = pg;

/** PostgreSQL connection pool */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/** Drizzle ORM database client with full schema */
export const db = drizzle(pool, { schema });

export type Database = typeof db;
