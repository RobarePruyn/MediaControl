/**
 * Bridge Agent internal API routes.
 * Called exclusively by the API server to interact with device platform adapters.
 * All routes expect the connection config in the request body (decrypted by the caller).
 * @module bridge-agent/routes
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';

import { createAdapter } from '../adapters/registry.js';

export const bridgeRouter: RouterType = Router();

/** Zod schema for connection config passed in request bodies */
const connectionConfigSchema = z.object({
  platform: z.string(),
}).passthrough();

/** Zod schema for control command requests */
const commandSchema = z.object({
  platformEndpointId: z.string(),
  commandType: z.enum(['POWER', 'INPUT', 'VOLUME', 'CHANNEL', 'MUTE']),
  payload: z.record(z.unknown()),
  connectionConfig: connectionConfigSchema,
  platformSlug: z.string(),
});

/**
 * POST /bridge/test/:controllerId
 * Test connectivity for a controller's platform credentials.
 */
bridgeRouter.post('/test/:controllerId', async (req: Request, res: Response) => {
  try {
    const { connectionConfig, platformSlug } = z.object({
      connectionConfig: connectionConfigSchema,
      platformSlug: z.string(),
    }).parse(req.body);

    const adapter = createAdapter(platformSlug, connectionConfig);
    await adapter.testConnection();

    res.json({ success: true, controllerId: req.params.controllerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({
      success: false,
      error: { code: 'CONNECTION_TEST_FAILED', message },
    });
  }
});

/**
 * POST /bridge/discover/:controllerId
 * Discover endpoints from a controller's platform.
 */
bridgeRouter.post('/discover/:controllerId', async (req: Request, res: Response) => {
  try {
    const { connectionConfig, platformSlug } = z.object({
      connectionConfig: connectionConfigSchema,
      platformSlug: z.string(),
    }).parse(req.body);

    const adapter = createAdapter(platformSlug, connectionConfig);
    const endpoints = await adapter.discoverEndpoints();

    res.json({ success: true, endpoints });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: { code: 'DISCOVERY_FAILED', message },
    });
  }
});

/**
 * POST /bridge/channels/:controllerId
 * Discover channels from a controller's platform.
 */
bridgeRouter.post('/channels/:controllerId', async (req: Request, res: Response) => {
  try {
    const { connectionConfig, platformSlug } = z.object({
      connectionConfig: connectionConfigSchema,
      platformSlug: z.string(),
    }).parse(req.body);

    const adapter = createAdapter(platformSlug, connectionConfig);
    const channels = await adapter.discoverChannels();

    res.json({ success: true, channels });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: { code: 'CHANNEL_DISCOVERY_FAILED', message },
    });
  }
});

/**
 * GET /bridge/state/:controllerId/:platformEndpointId
 * Get live state for a single endpoint.
 */
bridgeRouter.get('/state/:controllerId/:platformEndpointId', async (req: Request, res: Response) => {
  try {
    const { connectionConfig, platformSlug } = z.object({
      connectionConfig: connectionConfigSchema,
      platformSlug: z.string(),
    }).parse(req.query.config ? JSON.parse(req.query.config as string) : req.body);

    const adapter = createAdapter(platformSlug, connectionConfig);
    const endpointId = String(req.params.platformEndpointId);
    const state = await adapter.getEndpointState(endpointId);

    res.json({ success: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: { code: 'STATE_FETCH_FAILED', message },
    });
  }
});

/**
 * POST /bridge/command/:controllerId
 * Execute a control command against an endpoint via its platform adapter.
 */
bridgeRouter.post('/command/:controllerId', async (req: Request, res: Response) => {
  try {
    const parsed = commandSchema.parse(req.body);
    const adapter = createAdapter(parsed.platformSlug, parsed.connectionConfig);

    const state = await adapter.sendCommand({
      commandType: parsed.commandType,
      platformEndpointId: parsed.platformEndpointId,
      payload: parsed.payload as never,
    });

    res.json({ success: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: { code: 'COMMAND_FAILED', message },
    });
  }
});
