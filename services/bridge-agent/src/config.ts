/**
 * Environment configuration for the Bridge Agent service.
 * Validates required environment variables at startup using Zod.
 * @module bridge-agent/config
 */

import { z } from 'zod';

const configSchema = z.object({
  /** Shared secret for authenticating requests from the API server */
  BRIDGE_INTERNAL_SECRET: z.string().min(16),
  /** URL of the API server (used for callbacks if needed) */
  API_SERVER_URL: z.string().url().default('http://api-server:4000'),
  /** Port to listen on */
  PORT: z.coerce.number().default(4001),
  /** Node environment */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type BridgeConfig = z.infer<typeof configSchema>;

/**
 * Parse and validate environment configuration.
 * Fails fast with descriptive errors if any required variable is missing.
 */
export function loadConfig(): BridgeConfig {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid bridge agent configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}
