/**
 * Admin routes for user management.
 * Handles user CRUD and venue assignment operations.
 * @module api-server/routes/admin/users
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcrypt';

import type { Database } from '../../db/client.js';
import { users, userVenues, venues } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import { requireRole } from '../../middleware/auth.js';
import { fetchUserVenueIds } from '../../middleware/permissions.js';
import { AppError, ErrorCode } from '../../errors.js';

/** Bcrypt cost factor */
const BCRYPT_ROUNDS = 12;

const createSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(['super_admin', 'app_admin', 'venue_super_admin', 'venue_operator', 'end_user']),
  venueIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  email: z.string().email().max(255).optional(),
  role: z.enum(['super_admin', 'app_admin', 'venue_super_admin', 'venue_operator', 'end_user']).optional(),
  isActive: z.boolean().optional(),
});

const assignVenuesSchema = z.object({
  venueIds: z.array(z.string().uuid()),
});

/**
 * Create user management routes.
 * Requires super_admin or app_admin role.
 * @param db - Database client
 */
export function createUserRoutes(db: Database): RouterType {
  const router: RouterType = Router();

  // All user management routes require super_admin or app_admin
  router.use(requireRole('super_admin', 'app_admin'));

  /** GET /api/admin/users — List users for tenant with venue assignments */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)));

    // Fetch venue assignments for each user
    const usersWithVenues = await Promise.all(
      result.map(async (user) => {
        const venueIds = await fetchUserVenueIds(db, user.id);
        return {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role,
          authProvider: user.authProvider,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          venueIds,
        };
      }),
    );

    res.json({ success: true, data: usersWithVenues });
  });

  /** POST /api/admin/users — Create user */
  router.post('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const body = createSchema.parse(req.body);

    // Check email uniqueness
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email));

    if (existing) {
      throw new AppError(ErrorCode.CONFLICT, 'A user with this email already exists', 409);
    }

    const hashedPassword = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    const [created] = await db
      .insert(users)
      .values({
        tenantId,
        email: body.email,
        hashedPassword,
        role: body.role,
      })
      .returning();

    // Assign venues if provided
    if (body.venueIds?.length) {
      await db.insert(userVenues).values(
        body.venueIds.map((venueId) => ({
          userId: created.id,
          venueId,
        })),
      );
    }

    const venueIds = body.venueIds ?? [];

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        tenantId: created.tenantId,
        email: created.email,
        role: created.role,
        authProvider: created.authProvider,
        isActive: created.isActive,
        createdAt: created.createdAt,
        lastLoginAt: created.lastLoginAt,
        venueIds,
      },
    });
  });

  /** GET /api/admin/users/:id — Get user */
  router.get('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId), isNull(users.deletedAt)));

    if (!user) {
      throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    const venueIds = await fetchUserVenueIds(db, user.id);

    res.json({
      success: true,
      data: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        venueIds,
      },
    });
  });

  /** PATCH /api/admin/users/:id — Update user */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId), isNull(users.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    const updates: Record<string, unknown> = {};
    if (body.email !== undefined) updates.email = body.email;
    if (body.role !== undefined) updates.role = body.role;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    const venueIds = await fetchUserVenueIds(db, updated.id);

    res.json({
      success: true,
      data: {
        id: updated.id,
        tenantId: updated.tenantId,
        email: updated.email,
        role: updated.role,
        authProvider: updated.authProvider,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        lastLoginAt: updated.lastLoginAt,
        venueIds,
      },
    });
  });

  /** DELETE /api/admin/users/:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId), isNull(users.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));

    // Remove venue assignments
    await db.delete(userVenues).where(eq(userVenues.userId, id));

    res.status(204).send();
  });

  /** PUT /api/admin/users/:id/venues — Set venue assignments */
  router.put('/:id/venues', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);
    const body = assignVenuesSchema.parse(req.body);

    // Verify user belongs to tenant
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId), isNull(users.deletedAt)));

    if (!user) {
      throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    // Verify all venues belong to tenant
    if (body.venueIds.length > 0) {
      const tenantVenues = await db
        .select({ id: venues.id })
        .from(venues)
        .where(and(inArray(venues.id, body.venueIds), eq(venues.tenantId, tenantId)));

      if (tenantVenues.length !== body.venueIds.length) {
        throw new AppError(ErrorCode.FORBIDDEN, 'Some venues do not belong to your tenant', 403);
      }
    }

    // Replace all venue assignments
    await db.delete(userVenues).where(eq(userVenues.userId, id));

    if (body.venueIds.length > 0) {
      await db.insert(userVenues).values(
        body.venueIds.map((venueId) => ({
          userId: id,
          venueId,
        })),
      );
    }

    res.json({ success: true, data: { venueIds: body.venueIds } });
  });

  return router;
}
