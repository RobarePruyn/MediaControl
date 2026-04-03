/**
 * Environment configuration for the API server.
 * Validates all required environment variables at startup using Zod.
 * @module api-server/config
 */

import { z } from 'zod';

const configSchema = z.object({
  /** PostgreSQL connection string */
  DATABASE_URL: z.string().url(),
  /** Redis connection string */
  REDIS_URL: z.string().url(),
  /** Secret key for signing JWT access tokens */
  JWT_ACCESS_SECRET: z.string().min(32),
  /** Secret key for signing JWT refresh tokens */
  JWT_REFRESH_SECRET: z.string().min(32),
  /** AES-256 encryption key for controller credentials (hex-encoded, 64 chars) */
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32),
  /** Internal URL of the bridge agent service */
  BRIDGE_AGENT_URL: z.string().url().default('http://bridge-agent:4001'),
  /** Shared secret for bridge agent authentication */
  BRIDGE_INTERNAL_SECRET: z.string().min(16),
  /** Public host URL used for QR code URL generation */
  HOST: z.string().url().default('http://localhost'),
  /** File system path for QR code image storage */
  QR_STORAGE_PATH: z.string().default('/app/qr-storage'),
  /** Comma-separated list of allowed CORS origins */
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002'),
  /** Port to listen on */
  PORT: z.coerce.number().default(4000),
  /** Node environment */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Parse and validate environment configuration.
 * Fails fast with descriptive errors if any required variable is missing.
 */
export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}
