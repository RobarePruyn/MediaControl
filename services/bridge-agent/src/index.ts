/**
 * Bridge Agent entry point.
 * Starts the internal Express server that handles device platform API calls
 * on behalf of the API server. This service stays on-prem in cloud deployments.
 * @module bridge-agent/index
 */

import express from 'express';

import { loadConfig } from './config.js';
import { createInternalAuthMiddleware } from './middleware/internalAuth.js';
import { bridgeRouter } from './routes/index.js';
import { stopAllPolling } from './discovery/discoveryWorker.js';
import { getRegisteredPlatforms } from './adapters/registry.js';

const config = loadConfig();
const app = express();

// ─── Middleware ─────────────────────────────────────────────────────────

app.use(express.json());
app.use(createInternalAuthMiddleware(config.BRIDGE_INTERNAL_SECRET));

// ─── Routes ────────────────────────────────────────────────────────────

app.use('/bridge', bridgeRouter);

/** Health check — not protected by internal auth */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'bridge-agent',
    registeredPlatforms: getRegisteredPlatforms(),
  });
});

// ─── Start Server ──────────────────────────────────────────────────────

const server = app.listen(config.PORT, () => {
  console.log(`[Bridge Agent] Listening on port ${config.PORT}`);
  console.log(`[Bridge Agent] Registered platforms: ${getRegisteredPlatforms().join(', ')}`);
  console.log(`[Bridge Agent] Environment: ${config.NODE_ENV}`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`[Bridge Agent] Received ${signal}, shutting down...`);
  stopAllPolling();
  server.close(() => {
    console.log('[Bridge Agent] Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
