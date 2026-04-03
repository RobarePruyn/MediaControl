/**
 * Admin routes for endpoint (device) management.
 * Endpoints are discovered from controllers and can be assigned to groups.
 * @module api-server/routes/admin/endpoints
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { endpoints, groupEndpoints } from '../../db/schema.js';
import type { VenueScopedRequest } from '../../middleware/permissions.js';
import { AppError, ErrorCode } from '../../errors.js';

const updateSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
});

const bulkAssignSchema = z.object({
  endpointIds: z.array(z.string().uuid()).min(1),
  groupId: z.string().uuid(),
});

/**
 * Create endpoint admin routes.
 * @param db - Database client
 */
export function createEndpointRoutes(db: Database): RouterType {
  const router: RouterType = Router({ mergeParams: true });

  /** GET / — List endpoints for venue (filterable) */
  router.get('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;

    const result = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.venueId, venueId), isNull(endpoints.deletedAt)));

    res.json({
      success: true,
      data: result,
    });
  });

  /** PATCH /:id — Update endpoint */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.id, id), eq(endpoints.venueId, venueId), isNull(endpoints.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Endpoint not found', 404);
    }

    const updates: Record<string, unknown> = {};
    if (body.displayName !== undefined) updates.displayName = body.displayName;

    const [updated] = await db
      .update(endpoints)
      .set(updates)
      .where(eq(endpoints.id, id))
      .returning();

    res.json({ success: true, data: updated });
  });

  /** POST /bulk-assign — Assign multiple endpoints to a group */
  router.post('/bulk-assign', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const body = bulkAssignSchema.parse(req.body);

    // Verify all endpoints belong to this venue
    const venueEndpoints = await db
      .select({ id: endpoints.id })
      .from(endpoints)
      .where(
        and(
          inArray(endpoints.id, body.endpointIds),
          eq(endpoints.venueId, venueId),
          isNull(endpoints.deletedAt),
        ),
      );

    if (venueEndpoints.length !== body.endpointIds.length) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Some endpoints do not belong to this venue', 403);
    }

    // Get current max display order for the group
    const existingAssignments = await db
      .select({ displayOrder: groupEndpoints.displayOrder })
      .from(groupEndpoints)
      .where(eq(groupEndpoints.groupId, body.groupId));

    let maxOrder = existingAssignments.reduce(
      (max, a) => Math.max(max, a.displayOrder),
      -1,
    );

    // Create group_endpoint associations
    const values = body.endpointIds.map((endpointId) => ({
      groupId: body.groupId,
      endpointId,
      displayOrder: ++maxOrder,
    }));

    await db.insert(groupEndpoints).values(values);

    // Mark endpoints as assigned
    await db
      .update(endpoints)
      .set({ isAssigned: true })
      .where(inArray(endpoints.id, body.endpointIds));

    res.status(201).json({ success: true, data: { assigned: body.endpointIds.length } });
  });

  return router;
}
