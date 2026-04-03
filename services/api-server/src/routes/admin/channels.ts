/**
 * Admin routes for channel management.
 * Channels represent TV channels available at a venue, synced from controllers
 * or manually created.
 * @module api-server/routes/admin/channels
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { channels, venues, controllers } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import type { BridgeClient } from '../../services/bridgeClient.js';
import { decryptJson } from '../../utils/encryption.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  venueId: z.string().uuid(),
  platformChannelId: z.string().min(1),
  displayName: z.string().min(1).max(255),
  channelNumber: z.string().min(1).max(20),
  logoUrl: z.string().url().optional(),
  category: z.string().max(100).optional(),
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  channelOrders: z.array(z.object({
    id: z.string().uuid(),
    displayOrder: z.number().int().min(0),
  })),
});

/**
 * Create channel admin routes.
 * @param db - Database client
 * @param bridgeClient - Bridge agent HTTP client
 * @param encryptionKey - Credential encryption key
 */
export function createChannelRoutes(
  db: Database,
  bridgeClient: BridgeClient,
  encryptionKey: string,
): RouterType {
  const router: RouterType = Router();

  /** GET /api/admin/channels — List channels for venue */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const result = await db
      .select({ channel: channels })
      .from(channels)
      .innerJoin(venues, eq(channels.venueId, venues.id))
      .where(eq(venues.tenantId, tenantId))
      .orderBy(channels.displayOrder);

    res.json({ success: true, data: result.map((r) => r.channel) });
  });

  /** POST /api/admin/channels — Create channel manually */
  router.post('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const body = createSchema.parse(req.body);

    const [venue] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, body.venueId), eq(venues.tenantId, tenantId)));

    if (!venue) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
    }

    const [created] = await db.insert(channels).values(body).returning();
    res.status(201).json({ success: true, data: created });
  });

  /** POST /api/admin/channels/sync — Sync channels from controller */
  router.post('/sync', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const { controllerId } = z.object({ controllerId: z.string().uuid() }).parse(req.body);

    const [controller] = await db
      .select()
      .from(controllers)
      .innerJoin(venues, eq(controllers.venueId, venues.id))
      .where(and(eq(controllers.id, controllerId), eq(venues.tenantId, tenantId)));

    if (!controller) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    const config = decryptJson<Record<string, unknown>>(
      controller.controllers.connectionConfig,
      encryptionKey,
    );

    const discovered = await bridgeClient.discoverChannels(
      controllerId,
      controller.controllers.platformSlug,
      { platform: controller.controllers.platformSlug, ...config },
    );

    // Upsert discovered channels
    let order = 0;
    const created = [];
    for (const ch of discovered) {
      const [upserted] = await db
        .insert(channels)
        .values({
          venueId: controller.controllers.venueId,
          platformChannelId: ch.channelNumber,
          displayName: ch.displayName,
          channelNumber: ch.channelNumber,
          displayOrder: order++,
        })
        .onConflictDoNothing()
        .returning();

      if (upserted) created.push(upserted);
    }

    res.json({ success: true, data: { synced: discovered.length, created: created.length } });
  });

  /** PATCH /api/admin/channels/:id — Update channel */
  router.patch('/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [updated] = await db.update(channels).set(body).where(eq(channels.id, id)).returning();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Channel not found', 404);
    }

    res.json({ success: true, data: updated });
  });

  /** PATCH /api/admin/channels/reorder — Bulk reorder */
  router.patch('/reorder', async (req: Request, res: Response) => {
    const body = reorderSchema.parse(req.body);

    for (const item of body.channelOrders) {
      await db
        .update(channels)
        .set({ displayOrder: item.displayOrder })
        .where(eq(channels.id, item.id));
    }

    res.json({ success: true, data: { reordered: body.channelOrders.length } });
  });

  return router;
}
