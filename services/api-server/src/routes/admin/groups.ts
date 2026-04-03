/**
 * Admin routes for group (suite/room/zone/BOH) management.
 * Groups contain endpoints and are accessed via QR-code-delivered tokens.
 * @module api-server/routes/admin/groups
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { groups, venues, groupEndpoints, endpoints, groupAccessTokens } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import type { QrService } from '../../services/qrService.js';
import { generateAccessToken } from '../../utils/tokenGenerator.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['suite', 'room', 'zone', 'boh']),
  venueId: z.string().uuid(),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['suite', 'room', 'zone', 'boh']).optional(),
  description: z.string().optional(),
});

const addEndpointsSchema = z.object({
  endpointIds: z.array(z.string().uuid()).min(1),
});

const createTokenSchema = z.object({
  accessTier: z.enum(['event', 'seasonal', 'permanent']),
  eventId: z.string().uuid().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

/**
 * Create group admin routes.
 * @param db - Database client
 * @param qrService - QR code generation service
 */
export function createGroupRoutes(db: Database, qrService: QrService): RouterType {
  const router: RouterType = Router();

  /** GET /api/admin/groups — List groups */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const result = await db
      .select()
      .from(groups)
      .innerJoin(venues, eq(groups.venueId, venues.id))
      .where(and(eq(venues.tenantId, tenantId), isNull(groups.deletedAt)));

    res.json({ success: true, data: result.map((r) => r.groups) });
  });

  /** POST /api/admin/groups — Create group */
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
      .insert(groups)
      .values({
        venueId: body.venueId,
        name: body.name,
        type: body.type,
        description: body.description,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  });

  /** GET /api/admin/groups/:id — Get group with endpoints */
  router.get('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [result] = await db
      .select()
      .from(groups)
      .innerJoin(venues, eq(groups.venueId, venues.id))
      .where(and(eq(groups.id, id), eq(venues.tenantId, tenantId), isNull(groups.deletedAt)));

    if (!result) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    // Fetch endpoints in this group
    const groupEps = await db
      .select({ endpoint: endpoints, displayOrder: groupEndpoints.displayOrder })
      .from(groupEndpoints)
      .innerJoin(endpoints, eq(groupEndpoints.endpointId, endpoints.id))
      .where(eq(groupEndpoints.groupId, id))
      .orderBy(groupEndpoints.displayOrder);

    // Fetch active token
    const [activeToken] = await db
      .select()
      .from(groupAccessTokens)
      .where(and(eq(groupAccessTokens.groupId, id), eq(groupAccessTokens.isActive, true), isNull(groupAccessTokens.rotatedAt)));

    res.json({
      success: true,
      data: {
        ...result.groups,
        endpoints: groupEps.map((ge) => ({ ...ge.endpoint, displayOrder: ge.displayOrder })),
        activeToken: activeToken ?? null,
      },
    });
  });

  /** PATCH /api/admin/groups/:id — Update group */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(groups)
      .innerJoin(venues, eq(groups.venueId, venues.id))
      .where(and(eq(groups.id, id), eq(venues.tenantId, tenantId), isNull(groups.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    const [updated] = await db.update(groups).set(body).where(eq(groups.id, id)).returning();
    res.json({ success: true, data: updated });
  });

  /** DELETE /api/admin/groups/:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(groups)
      .innerJoin(venues, eq(groups.venueId, venues.id))
      .where(and(eq(groups.id, id), eq(venues.tenantId, tenantId), isNull(groups.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    await db.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, id));
    res.status(204).send();
  });

  /** POST /api/admin/groups/:id/endpoints — Add endpoints to group */
  router.post('/:id/endpoints', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = addEndpointsSchema.parse(req.body);

    const existing = await db
      .select({ displayOrder: groupEndpoints.displayOrder })
      .from(groupEndpoints)
      .where(eq(groupEndpoints.groupId, id));

    let maxOrder = existing.reduce((max, a) => Math.max(max, a.displayOrder), -1);

    const values = body.endpointIds.map((endpointId) => ({
      groupId: id,
      endpointId,
      displayOrder: ++maxOrder,
    }));

    await db.insert(groupEndpoints).values(values);
    res.status(201).json({ success: true, data: { added: body.endpointIds.length } });
  });

  /** DELETE /api/admin/groups/:id/endpoints/:endpointId — Remove endpoint from group */
  router.delete('/:id/endpoints/:endpointId', async (req: Request, res: Response) => {
    const groupId = String(req.params.id);
    const endpointId = String(req.params.endpointId);

    await db
      .delete(groupEndpoints)
      .where(and(eq(groupEndpoints.groupId, groupId), eq(groupEndpoints.endpointId, endpointId)));

    res.status(204).send();
  });

  // ─── Group Access Tokens ───────────────────────────────────────────

  /** GET /api/admin/groups/:id/tokens — List tokens for group */
  router.get('/:id/tokens', async (req: Request, res: Response) => {
    const groupId = String(req.params.id);

    const tokens = await db
      .select()
      .from(groupAccessTokens)
      .where(eq(groupAccessTokens.groupId, groupId))
      .orderBy(groupAccessTokens.createdAt);

    res.json({ success: true, data: tokens });
  });

  /** POST /api/admin/groups/:id/tokens — Create new access token */
  router.post('/:id/tokens', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const groupId = String(req.params.id);
    const body = createTokenSchema.parse(req.body);

    // Verify group belongs to tenant
    const [group] = await db
      .select()
      .from(groups)
      .innerJoin(venues, eq(groups.venueId, venues.id))
      .where(and(eq(groups.id, groupId), eq(venues.tenantId, tenantId)));

    if (!group) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    const token = generateAccessToken();

    const [created] = await db
      .insert(groupAccessTokens)
      .values({
        groupId,
        token,
        accessTier: body.accessTier,
        eventId: body.eventId,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      })
      .returning();

    // Generate QR code
    const venue = group.venues;
    const tenant = await db.query.tenants.findFirst({
      where: (t, { eq }) => eq(t.id, tenantId),
    });

    if (tenant && venue) {
      await qrService.generateAndSave(token, tenant.slug, venue.slug, groupId);
    }

    res.status(201).json({ success: true, data: created });
  });

  /** POST /api/admin/groups/:id/tokens/rotate — Rotate active token */
  router.post('/:id/tokens/rotate', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const groupId = String(req.params.id);
    const body = createTokenSchema.parse(req.body);

    // Deactivate current active token
    await db
      .update(groupAccessTokens)
      .set({ rotatedAt: new Date(), isActive: false })
      .where(
        and(
          eq(groupAccessTokens.groupId, groupId),
          eq(groupAccessTokens.isActive, true),
          isNull(groupAccessTokens.rotatedAt),
        ),
      );

    // Create new token
    const token = generateAccessToken();

    const [created] = await db
      .insert(groupAccessTokens)
      .values({
        groupId,
        token,
        accessTier: body.accessTier,
        eventId: body.eventId,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      })
      .returning();

    // Regenerate QR code
    const [group] = await db
      .select()
      .from(groups)
      .innerJoin(venues, eq(groups.venueId, venues.id))
      .where(eq(groups.id, groupId));

    if (group) {
      const tenant = await db.query.tenants.findFirst({
        where: (t, { eq }) => eq(t.id, tenantId),
      });
      if (tenant) {
        await qrService.generateAndSave(token, tenant.slug, group.venues.slug, groupId);
      }
    }

    res.json({ success: true, data: created });
  });

  /** DELETE /api/admin/groups/:id/tokens/:tokenId — Revoke token */
  router.delete('/:id/tokens/:tokenId', async (req: Request, res: Response) => {
    const tokenId = String(req.params.tokenId);

    await db
      .update(groupAccessTokens)
      .set({ isActive: false, rotatedAt: new Date() })
      .where(eq(groupAccessTokens.id, tokenId));

    res.status(204).send();
  });

  return router;
}
