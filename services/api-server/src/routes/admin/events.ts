/**
 * Admin routes for event management.
 * Events drive automatic token rotation for event-tier group access tokens.
 * @module api-server/routes/admin/events
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { events, venues } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  venueId: z.string().uuid(),
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
  const router: RouterType = Router();

  /** GET /api/admin/events — List events for venue */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const venueId = req.query.venueId as string | undefined;

    let result;
    if (venueId) {
      result = await db
        .select({ event: events })
        .from(events)
        .innerJoin(venues, eq(events.venueId, venues.id))
        .where(and(eq(events.venueId, venueId), eq(venues.tenantId, tenantId), isNull(events.deletedAt)))
        .orderBy(events.startsAt);
    } else {
      result = await db
        .select({ event: events })
        .from(events)
        .innerJoin(venues, eq(events.venueId, venues.id))
        .where(and(eq(venues.tenantId, tenantId), isNull(events.deletedAt)))
        .orderBy(events.startsAt);
    }

    res.json({ success: true, data: result.map((r) => r.event) });
  });

  /** POST /api/admin/events — Create event */
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

    const [created] = await db
      .insert(events)
      .values({
        venueId: body.venueId,
        name: body.name,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        preAccessMinutes: body.preAccessMinutes,
        postAccessMinutes: body.postAccessMinutes,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  });

  /** GET /api/admin/events/:id — Get event */
  router.get('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [result] = await db
      .select({ event: events })
      .from(events)
      .innerJoin(venues, eq(events.venueId, venues.id))
      .where(and(eq(events.id, id), eq(venues.tenantId, tenantId), isNull(events.deletedAt)));

    if (!result) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Event not found', 404);
    }

    res.json({ success: true, data: result.event });
  });

  /** PATCH /api/admin/events/:id — Update event */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(events)
      .innerJoin(venues, eq(events.venueId, venues.id))
      .where(and(eq(events.id, id), eq(venues.tenantId, tenantId), isNull(events.deletedAt)));

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

  /** DELETE /api/admin/events/:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(events)
      .innerJoin(venues, eq(events.venueId, venues.id))
      .where(and(eq(events.id, id), eq(venues.tenantId, tenantId), isNull(events.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Event not found', 404);
    }

    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));
    res.status(204).send();
  });

  return router;
}
