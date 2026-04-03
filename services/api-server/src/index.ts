/**
 * API Server entry point.
 * Bootstraps Express, middleware, routes, WebSocket connections,
 * and the token rotation cron job.
 * @module api-server/index
 */

import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';

import { loadConfig } from './config.js';
import { db } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import { tenantScope } from './middleware/tenantScope.js';
import { AuthService } from './services/authService.js';
import { BridgeClient } from './services/bridgeClient.js';
import { StateCache } from './services/stateCache.js';
import { QrService } from './services/qrService.js';
import { startTokenRotationJob } from './services/tokenRotationJob.js';
import { createAuthRoutes } from './routes/auth.js';
import { createTenantRoutes } from './routes/admin/tenants.js';
import { createVenueRoutes } from './routes/admin/venues.js';
import { createControllerRoutes } from './routes/admin/controllers.js';
import { createEndpointRoutes } from './routes/admin/endpoints.js';
import { createGroupRoutes } from './routes/admin/groups.js';
import { createChannelRoutes } from './routes/admin/channels.js';
import { createBrandingRoutes } from './routes/admin/branding.js';
import { createEventRoutes } from './routes/admin/events.js';
import { createTlsRoutes } from './routes/admin/tls.js';
import { createIdentityProviderRoutes } from './routes/admin/identityProviders.js';
import { createTriggerRoutes } from './routes/admin/triggers.js';
import { initWebSocketHub } from './websocket/index.js';

// ─── Config ────────────────────────────────────────────────────────────

const config = loadConfig();
const app: Express = express();
const httpServer = createServer(app);

// ─── Service Instances ─────────────────────────────────────────────────

const authService = new AuthService(db, config.JWT_ACCESS_SECRET, config.JWT_REFRESH_SECRET);
const bridgeClient = new BridgeClient(config.BRIDGE_AGENT_URL, config.BRIDGE_INTERNAL_SECRET);
const stateCache = new StateCache(config.REDIS_URL);
const qrService = new QrService(config.QR_STORAGE_PATH, config.HOST);

// ─── Global Middleware ─────────────────────────────────────────────────

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: config.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()),
  credentials: true,
}));

// ─── Public Routes ─────────────────────────────────────────────────────

app.use('/api/auth', createAuthRoutes(authService, db, config));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-server',
    redis: stateCache.connected,
  });
});

// ─── Protected Admin Routes ────────────────────────────────────────────

const adminRouter = express.Router();
adminRouter.use(requireAuth(config.JWT_ACCESS_SECRET));
adminRouter.use(tenantScope);

adminRouter.use('/tenants', createTenantRoutes(db));
adminRouter.use('/venues', createVenueRoutes(db));
adminRouter.use('/controllers', createControllerRoutes(db, bridgeClient, config.CREDENTIAL_ENCRYPTION_KEY));
adminRouter.use('/endpoints', createEndpointRoutes(db));
adminRouter.use('/groups', createGroupRoutes(db, qrService));
adminRouter.use('/channels', createChannelRoutes(db, bridgeClient, config.CREDENTIAL_ENCRYPTION_KEY));
adminRouter.use('/branding', createBrandingRoutes(db));
adminRouter.use('/events', createEventRoutes(db));
adminRouter.use('/tls', createTlsRoutes(db, config.QR_STORAGE_PATH.replace('qr-storage', 'tls-storage')));
adminRouter.use('/identity-providers', createIdentityProviderRoutes(db, config.CREDENTIAL_ENCRYPTION_KEY));
adminRouter.use('/triggers', createTriggerRoutes(db));

app.use('/api/admin', adminRouter);

// ─── Control Routes (Token-Gated, No Auth) ────────────────────────────
// Will be added in build step 7.

// ─── WebSocket ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer, path: '/ws/control' });
const wsHub = initWebSocketHub(db, stateCache);

wss.on('connection', (ws, req) => {
  // Extract group token from URL path: /ws/control/:groupToken
  const urlPath = req.url ?? '';
  const tokenMatch = urlPath.match(/\/ws\/control\/([^/?]+)/);
  const groupToken = tokenMatch?.[1];

  if (!groupToken) {
    ws.close(4000, 'Missing group token');
    return;
  }

  void wsHub.handleConnection(ws, groupToken);
});

// ─── Error Handler (must be last) ──────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────────────────

async function start() {
  // Connect to Redis
  await stateCache.connect();

  // Start token rotation cron job
  startTokenRotationJob(db);

  httpServer.listen(config.PORT, () => {
    console.log(`[API Server] Listening on port ${config.PORT}`);
    console.log(`[API Server] Environment: ${config.NODE_ENV}`);
    console.log(`[API Server] CORS origins: ${config.CORS_ALLOWED_ORIGINS}`);
  });
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`[API Server] Received ${signal}, shutting down...`);
  wsHub.shutdown();
  httpServer.close(async () => {
    await stateCache.disconnect();
    console.log('[API Server] Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Boot ──────────────────────────────────────────────────────────────

start().catch((err) => {
  console.error('[API Server] Failed to start:', err);
  process.exit(1);
});

// ─── Export for route registration in build step 5 ─────────────────────

export { app, adminRouter, db, config, authService, bridgeClient, stateCache, qrService };
