/**
 * Admin routes for controller (device platform instance) management.
 * Controllers represent connections to device platforms like VisionEdge.
 * @module api-server/routes/admin/controllers
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { controllers } from '../../db/schema.js';
import type { VenueScopedRequest } from '../../middleware/permissions.js';
import type { BridgeClient } from '../../services/bridgeClient.js';
import { encryptJson, decryptJson } from '../../utils/encryption.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['iptv', 'audio', 'video', 'lighting', 'bms']),
  platformSlug: z.string().min(1).max(50),
  connectionConfig: z.record(z.unknown()),
  pollIntervalSeconds: z.number().int().min(30).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  connectionConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  pollIntervalSeconds: z.number().int().min(30).optional(),
});

/**
 * Create controller admin routes.
 * @param db - Database client
 * @param bridgeClient - Bridge agent HTTP client
 * @param encryptionKey - Hex-encoded AES-256 key for credential encryption
 */
export function createControllerRoutes(
  db: Database,
  bridgeClient: BridgeClient,
  encryptionKey: string,
): RouterType {
  const router: RouterType = Router({ mergeParams: true });

  /** GET / — List controllers for venue */
  router.get('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;

    const result = await db
      .select({
        id: controllers.id,
        venueId: controllers.venueId,
        name: controllers.name,
        category: controllers.category,
        platformSlug: controllers.platformSlug,
        isActive: controllers.isActive,
        lastPolledAt: controllers.lastPolledAt,
        pollIntervalSeconds: controllers.pollIntervalSeconds,
        createdAt: controllers.createdAt,
      })
      .from(controllers)
      .where(and(eq(controllers.venueId, venueId), isNull(controllers.deletedAt)));

    res.json({ success: true, data: result });
  });

  /** POST / — Create controller */
  router.post('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const body = createSchema.parse(req.body);

    const encrypted = encryptJson(body.connectionConfig, encryptionKey);

    const [created] = await db
      .insert(controllers)
      .values({
        venueId,
        name: body.name,
        category: body.category,
        platformSlug: body.platformSlug,
        connectionConfig: encrypted,
        pollIntervalSeconds: body.pollIntervalSeconds ?? 300,
      })
      .returning();

    res.status(201).json({ success: true, data: { ...created, connectionConfig: undefined } });
  });

  /** GET /:id — Get controller */
  router.get('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [controller] = await db
      .select({
        id: controllers.id,
        venueId: controllers.venueId,
        name: controllers.name,
        category: controllers.category,
        platformSlug: controllers.platformSlug,
        isActive: controllers.isActive,
        lastPolledAt: controllers.lastPolledAt,
        pollIntervalSeconds: controllers.pollIntervalSeconds,
        createdAt: controllers.createdAt,
      })
      .from(controllers)
      .where(and(eq(controllers.id, id), eq(controllers.venueId, venueId), isNull(controllers.deletedAt)));

    if (!controller) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    res.json({ success: true, data: controller });
  });

  /** PATCH /:id — Update controller */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    // Verify controller belongs to this venue
    const [existing] = await db
      .select()
      .from(controllers)
      .where(and(eq(controllers.id, id), eq(controllers.venueId, venueId), isNull(controllers.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.pollIntervalSeconds !== undefined) updates.pollIntervalSeconds = body.pollIntervalSeconds;
    if (body.connectionConfig !== undefined) {
      updates.connectionConfig = encryptJson(body.connectionConfig, encryptionKey);
    }

    const [updated] = await db
      .update(controllers)
      .set(updates)
      .where(eq(controllers.id, id))
      .returning();

    res.json({ success: true, data: { ...updated, connectionConfig: undefined } });
  });

  /** DELETE /:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(controllers)
      .where(and(eq(controllers.id, id), eq(controllers.venueId, venueId), isNull(controllers.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    await db.update(controllers).set({ deletedAt: new Date() }).where(eq(controllers.id, id));
    res.status(204).send();
  });

  /** POST /:id/test — Test connectivity */
  router.post('/:id/test', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [controller] = await db
      .select()
      .from(controllers)
      .where(and(eq(controllers.id, id), eq(controllers.venueId, venueId), isNull(controllers.deletedAt)));

    if (!controller) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    const config = decryptJson<Record<string, unknown>>(
      controller.connectionConfig,
      encryptionKey,
    );

    await bridgeClient.testConnection(id, controller.platformSlug, {
      platform: controller.platformSlug,
      ...config,
    });

    res.json({ success: true, data: { message: 'Connection successful' } });
  });

  /** POST /:id/poll — Trigger endpoint discovery */
  router.post('/:id/poll', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [controller] = await db
      .select()
      .from(controllers)
      .where(and(eq(controllers.id, id), eq(controllers.venueId, venueId), isNull(controllers.deletedAt)));

    if (!controller) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    const config = decryptJson<Record<string, unknown>>(
      controller.connectionConfig,
      encryptionKey,
    );

    const discovered = await bridgeClient.discoverEndpoints(
      id,
      controller.platformSlug,
      { platform: controller.platformSlug, ...config },
    );

    // Update last polled timestamp
    await db.update(controllers).set({ lastPolledAt: new Date() }).where(eq(controllers.id, id));

    res.json({ success: true, data: { endpoints: discovered } });
  });

  return router;
}
