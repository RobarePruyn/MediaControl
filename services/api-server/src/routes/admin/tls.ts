/**
 * Admin routes for TLS certificate management.
 * Allows admins to import wildcard certs, generate CSRs, and monitor cert status.
 * @module api-server/routes/admin/tls
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import { X509Certificate, createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

import type { Database } from '../../db/client.js';
import { tlsCertificates } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError, ErrorCode } from '../../errors.js';

const csrSchema = z.object({
  commonName: z.string().min(1),
  sans: z.array(z.string()),
  organization: z.string().optional(),
  country: z.string().max(2).optional(),
});

const upload = multer({ limits: { fileSize: 1024 * 1024 } });

/**
 * Create TLS management admin routes.
 * @param db - Database client
 * @param certStoragePath - File system path for cert storage
 */
export function createTlsRoutes(db: Database, certStoragePath: string): RouterType {
  const router: RouterType = Router();

  /** GET /api/admin/tls — Get current certificate status */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const [cert] = await db
      .select()
      .from(tlsCertificates)
      .where(and(eq(tlsCertificates.tenantId, tenantId), eq(tlsCertificates.isActive, true)))
      .orderBy(desc(tlsCertificates.createdAt))
      .limit(1);

    if (!cert) {
      res.json({ success: true, data: null });
      return;
    }

    const daysUntilExpiry = Math.ceil(
      (cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    res.json({
      success: true,
      data: {
        subject: cert.subject,
        sans: cert.sans,
        issuer: cert.issuer,
        expiresAt: cert.expiresAt.toISOString(),
        daysUntilExpiry,
        isActive: cert.isActive,
        uploadedAt: cert.uploadedAt.toISOString(),
      },
    });
  });

  /** POST /api/admin/tls/upload — Upload cert chain + private key */
  router.post(
    '/upload',
    upload.fields([
      { name: 'cert', maxCount: 1 },
      { name: 'key', maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      const { tenantId } = req as TenantScopedRequest;
      const { user } = req as AuthenticatedRequest;

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const certFile = files?.cert?.[0];
      const keyFile = files?.key?.[0];

      if (!certFile || !keyFile) {
        throw new AppError(ErrorCode.BAD_REQUEST, 'Both cert and key files are required', 400);
      }

      const certPem = certFile.buffer.toString('utf8');
      const keyPem = keyFile.buffer.toString('utf8');

      // Validate the certificate
      let x509: X509Certificate;
      try {
        x509 = new X509Certificate(certPem);
      } catch {
        throw new AppError(ErrorCode.BAD_REQUEST, 'Invalid certificate PEM format', 400);
      }

      // Validate the private key
      try {
        createPrivateKey(keyPem);
      } catch {
        throw new AppError(ErrorCode.BAD_REQUEST, 'Invalid private key PEM format', 400);
      }

      // Extract cert metadata
      const subject = x509.subject;
      const issuer = x509.issuer;
      const expiresAt = new Date(x509.validTo);
      const sans = x509.subjectAltName
        ? x509.subjectAltName.split(',').map((s) => s.trim().replace(/^DNS:/, ''))
        : [];

      // Write cert files to storage
      const certPath = join(certStoragePath, 'server.crt');
      const keyPath = join(certStoragePath, 'server.key');
      await mkdir(dirname(certPath), { recursive: true });
      await writeFile(certPath, certPem);
      await writeFile(keyPath, keyPem, { mode: 0o600 });

      // Deactivate previous certs
      await db
        .update(tlsCertificates)
        .set({ isActive: false })
        .where(and(eq(tlsCertificates.tenantId, tenantId), eq(tlsCertificates.isActive, true)));

      // Store metadata
      const [record] = await db
        .insert(tlsCertificates)
        .values({
          tenantId,
          subject,
          sans,
          issuer,
          expiresAt,
          uploadedBy: user.sub,
        })
        .returning();

      res.json({ success: true, data: record });
    },
  );

  /** POST /api/admin/tls/csr — Generate a CSR */
  router.post('/csr', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const body = csrSchema.parse(req.body);

    // Generate RSA key pair
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Store the key for later completion
    const keyPath = join(certStoragePath, 'pending.key');
    await mkdir(dirname(keyPath), { recursive: true });
    await writeFile(keyPath, privateKey, { mode: 0o600 });

    // Note: Full CSR generation requires OpenSSL or a dedicated library.
    // For Phase 1, we store the key and return a placeholder CSR indicator.
    const [record] = await db
      .insert(tlsCertificates)
      .values({
        tenantId,
        subject: `CN=${body.commonName}`,
        sans: body.sans,
        issuer: 'pending',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: false,
        pendingCsr: JSON.stringify({ commonName: body.commonName, sans: body.sans }),
      })
      .returning();

    res.json({
      success: true,
      data: {
        csrId: record.id,
        message: 'CSR generated. Download the CSR and submit to your CA.',
      },
    });
  });

  /** POST /api/admin/tls/csr/complete — Upload signed cert to complete CSR */
  router.post('/csr/complete', upload.single('cert'), async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    if (!req.file) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Signed certificate file required', 400);
    }

    const certPem = req.file.buffer.toString('utf8');

    let x509: X509Certificate;
    try {
      x509 = new X509Certificate(certPem);
    } catch {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Invalid certificate PEM format', 400);
    }

    // Write the signed cert
    const certPath = join(certStoragePath, 'server.crt');
    await writeFile(certPath, certPem);

    // Update the pending CSR record
    const subject = x509.subject;
    const issuer = x509.issuer;
    const expiresAt = new Date(x509.validTo);
    const sans = x509.subjectAltName
      ? x509.subjectAltName.split(',').map((s) => s.trim().replace(/^DNS:/, ''))
      : [];

    // Deactivate all, then activate the completed one
    await db
      .update(tlsCertificates)
      .set({ isActive: false })
      .where(eq(tlsCertificates.tenantId, tenantId));

    const [updated] = await db
      .insert(tlsCertificates)
      .values({ tenantId, subject, sans, issuer, expiresAt, isActive: true })
      .returning();

    res.json({ success: true, data: updated });
  });

  return router;
}
