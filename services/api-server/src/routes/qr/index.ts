/**
 * QR code routes — public endpoints for QR code image access and download.
 * QR codes encode /control/{token} URLs and are served as static images.
 * @module api-server/routes/qr
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { groupAccessTokens } from '../../db/schema.js';
import type { QrService } from '../../services/qrService.js';
import { AppError, ErrorCode } from '../../errors.js';

/**
 * Create QR code routes.
 * @param db - Database client
 * @param qrService - QR code generation service
 * @param host - Public host URL
 */
export function createQrRoutes(db: Database, qrService: QrService, host: string): RouterType {
  const router: RouterType = Router();

  /**
   * GET /api/qr/:groupToken — Redirect to the control page URL.
   * Useful as a simple redirect for QR code scanners.
   */
  router.get('/:groupToken', async (req: Request, res: Response) => {
    const token = String(req.params.groupToken);

    const [record] = await db
      .select()
      .from(groupAccessTokens)
      .where(eq(groupAccessTokens.token, token));

    if (!record) {
      throw new AppError(ErrorCode.NOT_FOUND, 'QR code not found', 404);
    }

    res.redirect(`${host}/control/${token}`);
  });

  /**
   * GET /api/qr/:groupToken/png — Download QR code as PNG.
   * Returns a 1200x1200px PNG image suitable for print.
   */
  router.get('/:groupToken/png', async (req: Request, res: Response) => {
    const token = String(req.params.groupToken);

    const [record] = await db
      .select()
      .from(groupAccessTokens)
      .where(eq(groupAccessTokens.token, token));

    if (!record) {
      throw new AppError(ErrorCode.NOT_FOUND, 'QR code not found', 404);
    }

    const pngBuffer = await qrService.generatePng(token);

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${token}.png"`,
      'Cache-Control': 'public, max-age=3600',
    });
    res.send(pngBuffer);
  });

  /**
   * GET /api/qr/:groupToken/svg — Download QR code as SVG.
   * Returns an SVG for scalable print or embed.
   */
  router.get('/:groupToken/svg', async (req: Request, res: Response) => {
    const token = String(req.params.groupToken);

    const [record] = await db
      .select()
      .from(groupAccessTokens)
      .where(eq(groupAccessTokens.token, token));

    if (!record) {
      throw new AppError(ErrorCode.NOT_FOUND, 'QR code not found', 404);
    }

    const svg = await qrService.generateSvg(token);

    res.set({
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `attachment; filename="qr-${token}.svg"`,
      'Cache-Control': 'public, max-age=3600',
    });
    res.send(svg);
  });

  return router;
}
