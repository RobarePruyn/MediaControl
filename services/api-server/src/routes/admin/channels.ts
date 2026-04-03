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
import { channels, controllers } from '../../db/schema.js';
import type { VenueScopedRequest } from '../../middleware/permissions.js';
import type { BridgeClient } from '../../services/bridgeClient.js';
import { decryptJson } from '../../utils/encryption.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
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
  const router: RouterType = Router({ mergeParams: true });

  /** GET / — List channels for venue */
  router.get('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;

    const result = await db
      .select()
      .from(channels)
      .where(eq(channels.venueId, venueId))
      .orderBy(channels.displayOrder);

    res.json({ success: true, data: result });
  });

  /** POST / — Create channel manually */
  router.post('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const body = createSchema.parse(req.body);

    const [created] = await db.insert(channels).values({ ...body, venueId, source: 'manual' }).returning();
    res.status(201).json({ success: true, data: created });
  });

  /** POST /sync — Sync channels from controller */
  router.post('/sync', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const { controllerId } = z.object({ controllerId: z.string().uuid() }).parse(req.body);

    // Validate controller belongs to this venue
    const [controller] = await db
      .select()
      .from(controllers)
      .where(and(eq(controllers.id, controllerId), eq(controllers.venueId, venueId)));

    if (!controller) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Controller not found', 404);
    }

    const config = decryptJson<Record<string, unknown>>(
      controller.connectionConfig,
      encryptionKey,
    );

    const discovered = await bridgeClient.discoverChannels(
      controllerId,
      controller.platformSlug,
      { platform: controller.platformSlug, ...config },
    );

    // Upsert discovered channels — match on (venueId, platformChannelId)
    let order = 0;
    let createdCount = 0;
    let updatedCount = 0;
    for (const ch of discovered) {
      const [existing] = await db
        .select({ id: channels.id })
        .from(channels)
        .where(
          and(
            eq(channels.venueId, venueId),
            eq(channels.platformChannelId, ch.channelNumber),
          ),
        );

      if (existing) {
        await db
          .update(channels)
          .set({
            displayName: ch.displayName,
            channelNumber: ch.channelNumber,
            source: 'synced',
          })
          .where(eq(channels.id, existing.id));
        updatedCount++;
      } else {
        await db.insert(channels).values({
          venueId,
          platformChannelId: ch.channelNumber,
          displayName: ch.displayName,
          channelNumber: ch.channelNumber,
          source: 'synced',
          displayOrder: order++,
        });
        createdCount++;
      }
    }

    res.json({ success: true, data: { synced: discovered.length, created: createdCount, updated: updatedCount } });
  });

  /** PATCH /:id — Update channel */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [updated] = await db
      .update(channels)
      .set(body)
      .where(and(eq(channels.id, id), eq(channels.venueId, venueId)))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Channel not found', 404);
    }

    res.json({ success: true, data: updated });
  });

  /** PATCH /reorder — Bulk reorder */
  router.patch('/reorder', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const body = reorderSchema.parse(req.body);

    for (const item of body.channelOrders) {
      await db
        .update(channels)
        .set({ displayOrder: item.displayOrder })
        .where(and(eq(channels.id, item.id), eq(channels.venueId, venueId)));
    }

    res.json({ success: true, data: { reordered: body.channelOrders.length } });
  });

  /** DELETE /:id — Delete a channel */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, id), eq(channels.venueId, venueId)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Channel not found', 404);
    }

    await db.delete(channels).where(eq(channels.id, id));
    res.status(204).send();
  });

  return router;
}
