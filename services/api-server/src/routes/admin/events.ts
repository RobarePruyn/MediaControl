/**
 * Admin routes for event management.
 * Events drive automatic token rotation for event-tier group access tokens.
 * @module api-server/routes/admin/events
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { events } from '../../db/schema.js';
import type { VenueScopedRequest } from '../../middleware/permissions.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  preAccessMinutes: z.number().int().min(0).optional(),
  postAccessMinutes: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  preAccessMinutes: z.number().int().min(0).optional(),
  postAccessMinutes: z.number().int().min(0).optional(),
});

/**
 * Create event admin routes.
 * @param db - Database client
 */
export function createEventRoutes(db: Database): RouterType {
  const router: RouterType = Router({ mergeParams: true });

  /** GET / — List events for venue */
  router.get('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;

    const result = await db
      .select()
      .from(events)
      .where(and(eq(events.venueId, venueId), isNull(events.deletedAt)))
      .orderBy(events.startsAt);

    res.json({ success: true, data: result });
  });

  /** POST / — Create event */
  router.post('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const body = createSchema.parse(req.body);

    const [created] = await db
      .insert(events)
      .values({
        venueId,
        name: body.name,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        preAccessMinutes: body.preAccessMinutes,
        postAccessMinutes: body.postAccessMinutes,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  });

  /** GET /:id — Get event */
  router.get('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.venueId, venueId), isNull(events.deletedAt)));

    if (!event) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Event not found', 404);
    }

    res.json({ success: true, data: event });
  });

  /** PATCH /:id — Update event */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.venueId, venueId), isNull(events.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Event not found', 404);
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.startsAt !== undefined) updates.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) updates.endsAt = new Date(body.endsAt);
    if (body.preAccessMinutes !== undefined) updates.preAccessMinutes = body.preAccessMinutes;
    if (body.postAccessMinutes !== undefined) updates.postAccessMinutes = body.postAccessMinutes;

    const [updated] = await db.update(events).set(updates).where(eq(events.id, id)).returning();
    res.json({ success: true, data: updated });
  });

  /** DELETE /:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.venueId, venueId), isNull(events.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Event not found', 404);
    }

    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));
    res.status(204).send();
  });

  return router;
}
