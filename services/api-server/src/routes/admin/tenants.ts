/**
 * Admin routes for tenant management (meta-admin only).
 * Tenants are the top-level organizational unit in SuiteCommand.
 * @module api-server/routes/admin/tenants
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { tenants } from '../../db/schema.js';
import { requireRole } from '../../middleware/auth.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  planTier: z.enum(['basic', 'professional', 'enterprise']).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  planTier: z.enum(['basic', 'professional', 'enterprise']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Create tenant admin routes. All routes require super_admin role.
 * @param db - Database client
 */
export function createTenantRoutes(db: Database): RouterType {
  const router: RouterType = Router();

  // All tenant routes require super_admin
  router.use(requireRole('super_admin'));

  /** GET /api/admin/tenants — List all tenants */
  router.get('/', async (_req: Request, res: Response) => {
    const result = await db
      .select()
      .from(tenants)
      .where(isNull(tenants.deletedAt));

    res.json({ success: true, data: result });
  });

  /** POST /api/admin/tenants — Create tenant */
  router.post('/', async (req: Request, res: Response) => {
    const body = createSchema.parse(req.body);

    const [created] = await db
      .insert(tenants)
      .values(body)
      .returning();

    res.status(201).json({ success: true, data: created });
  });

  /** GET /api/admin/tenants/:id — Get tenant */
  router.get('/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id));

    if (!tenant) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Tenant not found', 404);
    }

    res.json({ success: true, data: tenant });
  });

  /** PATCH /api/admin/tenants/:id — Update tenant */
  router.patch('/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [updated] = await db
      .update(tenants)
      .set(body)
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Tenant not found', 404);
    }

    res.json({ success: true, data: updated });
  });

  return router;
}
