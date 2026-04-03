/**
 * Admin routes for venue branding configuration.
 * Branding controls the visual appearance of the end-user control UI.
 * @module api-server/routes/admin/branding
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';

import type { Database } from '../../db/client.js';
import { brandingConfigs, venues } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import { AppError, ErrorCode } from '../../errors.js';

const updateSchema = z.object({
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  accentColor: z.string().max(20).optional(),
  textOnPrimary: z.string().max(20).optional(),
  textOnSecondary: z.string().max(20).optional(),
  fontFamily: z.string().max(100).optional(),
  buttonRadius: z.string().max(20).optional(),
  customCss: z.string().nullable().optional(),
});

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

/**
 * Create branding admin routes.
 * @param db - Database client
 */
export function createBrandingRoutes(db: Database): RouterType {
  const router: RouterType = Router();

  /** GET /api/admin/branding — Get branding config for venue */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const venueId = req.query.venueId as string | undefined;

    if (!venueId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'venueId query parameter required', 400);
    }

    // Verify venue belongs to tenant
    const [venue] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, venueId), eq(venues.tenantId, tenantId)));

    if (!venue) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
    }

    const [config] = await db
      .select()
      .from(brandingConfigs)
      .where(eq(brandingConfigs.venueId, venueId));

    res.json({ success: true, data: config ?? null });
  });

  /** PUT /api/admin/branding — Update branding config (upsert) */
  router.put('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const { venueId, ...body } = z.object({
      venueId: z.string().uuid(),
      ...updateSchema.shape,
    }).parse(req.body);

    // Verify venue belongs to tenant
    const [venue] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, venueId), eq(venues.tenantId, tenantId)));

    if (!venue) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
    }

    // Check if branding config exists
    const [existing] = await db
      .select()
      .from(brandingConfigs)
      .where(eq(brandingConfigs.venueId, venueId));

    let result;
    if (existing) {
      [result] = await db
        .update(brandingConfigs)
        .set(body)
        .where(eq(brandingConfigs.venueId, venueId))
        .returning();
    } else {
      [result] = await db
        .insert(brandingConfigs)
        .values({ venueId, ...body })
        .returning();
    }

    res.json({ success: true, data: result });
  });

  /** POST /api/admin/branding/logo — Upload logo */
  router.post('/logo', upload.single('logo'), async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const venueId = req.body.venueId as string;

    if (!venueId || !req.file) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'venueId and logo file required', 400);
    }

    // In production, upload to object storage and get URL
    // For Phase 1, store as base64 data URI
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    await db
      .update(brandingConfigs)
      .set({ logoUrl: dataUri })
      .where(eq(brandingConfigs.venueId, venueId));

    res.json({ success: true, data: { logoUrl: dataUri } });
  });

  return router;
}
