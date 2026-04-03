/**
 * Admin routes for controller (device platform instance) management.
 * Controllers represent connections to device platforms like VisionEdge.
 * @module api-server/routes/admin/controllers
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { controllers, venues } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import type { BridgeClient } from '../../services/bridgeClient.js';
import { encryptJson, decryptJson } from '../../utils/encryption.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  platformSlug: z.string().min(1).max(50),
  connectionConfig: z.record(z.unknown()),
  venueId: z.string().uuid(),
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
  const router: RouterType = Router();

  /** GET /api/admin/controllers — List controllers for tenant */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const result = await db
      .select({
        id: controllers.id,
        venueId: controllers.venueId,
        name: controllers.name,
        platformSlug: controllers.platformSlug,
        isActive: controllers.isActive,
        lastPolledAt: controllers.lastPolledAt,
        pollIntervalSeconds: controllers.pollIntervalSeconds,
        createdAt: controllers.createdAt,
      })
      .from(controllers)
      .innerJoin(venues, eq(controllers.venueId, venues.id))
      .where(and(eq(venues.tenantId, tenantId), isNull(controllers.deletedAt)));

    res.json({ success: true, data: result });
  });

  /** POST /api/admin/controllers — Create controller */
  router.post('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const body = createSchema.parse(req.body);

    // Verify venue belongs to tenant
    const [venue] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, body.venueId), eq(venues.tenantId, tenantId)));

    if (!venue) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
    }

    const encrypted = encryptJson(body.connectionConfig, encryptionKey);

    const [created] = await db
      .insert(controllers)
      .values({
        venueId: body.venueId,
        name: body.name,
        platformSlug: body.platformSlug,
        connectionConfig: encrypted,
        pollIntervalSeconds: body.pollIntervalSeconds ?? 300,
      })
      .returning();

    res.status(201).json({ success: true, data: { ...created, connectionConfig: undefined } });
  });

  /** GET /api/admin/controllers/:id — Get controller */
  router.get('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [controller] = await db
      .select({
        id: controllers.id,
        venueId: controllers.venueId,
        name: controllers.name,
        platformSlug: controllers.platformSlug,
        isActive: controllers.isActive,
        lastPolledAt: controllers.lastPolledAt,
        pollIntervalSeconds: controllers.pollIntervalSeconds,
        createdAt: controllers.createdAt,
      })
      .from(controllers)
      .innerJoin(venues, eq(controllers.venueId, venues.id))
      .where(and(eq(controllers.id, id), eq(venues.tenantId, tenantId), isNull(controllers.deletedAt)));

    if (!controller) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    res.json({ success: true, data: controller });
  });

  /** PATCH /api/admin/controllers/:id — Update controller */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    // Verify controller belongs to tenant
    const [existing] = await db
      .select()
      .from(controllers)
      .innerJoin(venues, eq(controllers.venueId, venues.id))
      .where(and(eq(controllers.id, id), eq(venues.tenantId, tenantId), isNull(controllers.deletedAt)));

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

  /** DELETE /api/admin/controllers/:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(controllers)
      .innerJoin(venues, eq(controllers.venueId, venues.id))
      .where(and(eq(controllers.id, id), eq(venues.tenantId, tenantId), isNull(controllers.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    await db.update(controllers).set({ deletedAt: new Date() }).where(eq(controllers.id, id));
    res.status(204).send();
  });

  /** POST /api/admin/controllers/:id/test — Test connectivity */
  router.post('/:id/test', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [controller] = await db
      .select()
      .from(controllers)
      .innerJoin(venues, eq(controllers.venueId, venues.id))
      .where(and(eq(controllers.id, id), eq(venues.tenantId, tenantId), isNull(controllers.deletedAt)));

    if (!controller) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    const config = decryptJson<Record<string, unknown>>(
      controller.controllers.connectionConfig,
      encryptionKey,
    );

    await bridgeClient.testConnection(id, controller.controllers.platformSlug, {
      platform: controller.controllers.platformSlug,
      ...config,
    });

    res.json({ success: true, data: { message: 'Connection successful' } });
  });

  /** POST /api/admin/controllers/:id/poll — Trigger endpoint discovery */
  router.post('/:id/poll', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [controller] = await db
      .select()
      .from(controllers)
      .innerJoin(venues, eq(controllers.venueId, venues.id))
      .where(and(eq(controllers.id, id), eq(venues.tenantId, tenantId), isNull(controllers.deletedAt)));

    if (!controller) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    const config = decryptJson<Record<string, unknown>>(
      controller.controllers.connectionConfig,
      encryptionKey,
    );

    const discovered = await bridgeClient.discoverEndpoints(
      id,
      controller.controllers.platformSlug,
      { platform: controller.controllers.platformSlug, ...config },
    );

    // Update last polled timestamp
    await db.update(controllers).set({ lastPolledAt: new Date() }).where(eq(controllers.id, id));

    res.json({ success: true, data: { endpoints: discovered } });
  });

  return router;
}
