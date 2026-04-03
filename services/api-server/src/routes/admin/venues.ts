/**
 * Admin routes for venue management.
 * Venues are physical locations owned by a tenant.
 * @module api-server/routes/admin/venues
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { venues } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  timezone: z.string().max(64).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  timezone: z.string().max(64).optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().max(20).nullable().optional(),
  secondaryColor: z.string().max(20).nullable().optional(),
  accentColor: z.string().max(20).nullable().optional(),
});

/**
 * Create venue admin routes.
 * @param db - Database client
 */
export function createVenueRoutes(db: Database): RouterType {
  const router: RouterType = Router();

  /** GET /api/admin/venues — List venues for tenant */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const result = await db
      .select()
      .from(venues)
      .where(and(eq(venues.tenantId, tenantId), isNull(venues.deletedAt)));

    res.json({ success: true, data: result });
  });

  /** POST /api/admin/venues — Create venue */
  router.post('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const body = createSchema.parse(req.body);

    const [created] = await db
      .insert(venues)
      .values({ ...body, tenantId })
      .returning();

    res.status(201).json({ success: true, data: created });
  });

  /** GET /api/admin/venues/:id — Get venue */
  router.get('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [venue] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, id), eq(venues.tenantId, tenantId), isNull(venues.deletedAt)));

    if (!venue) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
    }

    res.json({ success: true, data: venue });
  });

  /** PATCH /api/admin/venues/:id — Update venue */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, id), eq(venues.tenantId, tenantId), isNull(venues.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
    }

    const [updated] = await db.update(venues).set(body).where(eq(venues.id, id)).returning();
    res.json({ success: true, data: updated });
  });

  /** DELETE /api/admin/venues/:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, id), eq(venues.tenantId, tenantId), isNull(venues.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
    }

    await db.update(venues).set({ deletedAt: new Date() }).where(eq(venues.id, id));
    res.status(204).send();
  });

  return router;
}
