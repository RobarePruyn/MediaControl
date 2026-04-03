/**
 * Admin routes for group (suite/room/zone/BOH) management.
 * Groups contain endpoints and are accessed via QR-code-delivered tokens.
 * @module api-server/routes/admin/groups
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { groups, venues, groupEndpoints, endpoints, groupAccessTokens, tenants } from '../../db/schema.js';
import type { VenueScopedRequest } from '../../middleware/permissions.js';
import type { QrService } from '../../services/qrService.js';
import { generateAccessToken } from '../../utils/tokenGenerator.js';
import { AppError, ErrorCode } from '../../errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['suite', 'room', 'zone', 'boh']),
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
  const router: RouterType = Router({ mergeParams: true });

  /** GET / — List groups for venue */
  router.get('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;

    const result = await db
      .select()
      .from(groups)
      .where(and(eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    res.json({ success: true, data: result });
  });

  /** POST / — Create group */
  router.post('/', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const body = createSchema.parse(req.body);

    const [created] = await db
      .insert(groups)
      .values({
        venueId,
        name: body.name,
        type: body.type,
        description: body.description,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  });

  /** GET /:id — Get group with endpoints */
  router.get('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    if (!group) {
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
        ...group,
        endpoints: groupEps.map((ge) => ({ ...ge.endpoint, displayOrder: ge.displayOrder })),
        activeToken: activeToken ?? null,
      },
    });
  });

  /** PATCH /:id — Update group */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    const [updated] = await db.update(groups).set(body).where(eq(groups.id, id)).returning();
    res.json({ success: true, data: updated });
  });

  /** DELETE /:id — Soft delete */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    await db.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, id));
    res.status(204).send();
  });

  /** POST /:id/endpoints — Add endpoints to group */
  router.post('/:id/endpoints', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const id = String(req.params.id);
    const body = addEndpointsSchema.parse(req.body);

    // Verify group belongs to this venue
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    if (!group) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

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

  /** DELETE /:id/endpoints/:endpointId — Remove endpoint from group */
  router.delete('/:id/endpoints/:endpointId', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const groupId = String(req.params.id);
    const endpointId = String(req.params.endpointId);

    // Verify group belongs to this venue
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    if (!group) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    await db
      .delete(groupEndpoints)
      .where(and(eq(groupEndpoints.groupId, groupId), eq(groupEndpoints.endpointId, endpointId)));

    res.status(204).send();
  });

  // ─── Group Access Tokens ───────────────────────────────────────────

  /** GET /:id/tokens — List tokens for group */
  router.get('/:id/tokens', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const groupId = String(req.params.id);

    // Verify group belongs to this venue
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    if (!group) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    const tokens = await db
      .select()
      .from(groupAccessTokens)
      .where(eq(groupAccessTokens.groupId, groupId))
      .orderBy(groupAccessTokens.createdAt);

    res.json({ success: true, data: tokens });
  });

  /** POST /:id/tokens — Create new access token */
  router.post('/:id/tokens', async (req: Request, res: Response) => {
    const { venueId, tenantId } = req as VenueScopedRequest;
    const groupId = String(req.params.id);
    const body = createTokenSchema.parse(req.body);

    // Verify group belongs to this venue
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

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
    const [venue] = await db.select().from(venues).where(eq(venues.id, venueId));
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    if (tenant && venue) {
      await qrService.generateAndSave(token, tenant.slug, venue.slug, groupId);
    }

    res.status(201).json({ success: true, data: created });
  });

  /** POST /:id/tokens/rotate — Rotate active token */
  router.post('/:id/tokens/rotate', async (req: Request, res: Response) => {
    const { venueId, tenantId } = req as VenueScopedRequest;
    const groupId = String(req.params.id);
    const body = createTokenSchema.parse(req.body);

    // Verify group belongs to this venue
    const [existingGroup] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    if (!existingGroup) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

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
    const [venue] = await db.select().from(venues).where(eq(venues.id, venueId));
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    if (tenant && venue) {
      await qrService.generateAndSave(token, tenant.slug, venue.slug, groupId);
    }

    res.json({ success: true, data: created });
  });

  /** DELETE /:id/tokens/:tokenId — Revoke token */
  router.delete('/:id/tokens/:tokenId', async (req: Request, res: Response) => {
    const { venueId } = req as VenueScopedRequest;
    const groupId = String(req.params.id);
    const tokenId = String(req.params.tokenId);

    // Verify group belongs to this venue
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.venueId, venueId), isNull(groups.deletedAt)));

    if (!group) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
    }

    await db
      .update(groupAccessTokens)
      .set({ isActive: false, rotatedAt: new Date() })
      .where(eq(groupAccessTokens.id, tokenId));

    res.status(204).send();
  });

  return router;
}
