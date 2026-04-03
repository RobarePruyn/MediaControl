/**
 * Admin routes for identity provider and SSO configuration management.
 * Manages both the generic identity_providers table and the OIDC-specific sso_configs table.
 * @module api-server/routes/admin/identityProviders
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { identityProviders, ssoConfigs } from '../../db/schema.js';
import type { TenantScopedRequest } from '../../middleware/tenantScope.js';
import { encrypt, encryptJson } from '../../utils/encryption.js';
import { AppError, ErrorCode } from '../../errors.js';

const createIdpSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  protocol: z.enum(['oidc', 'saml', 'ldap']),
  config: z.record(z.unknown()),
  attributeMapping: z.record(z.string()).optional(),
});

const updateIdpSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  attributeMapping: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const upsertSsoSchema = z.object({
  providerName: z.string().min(1).max(64),
  issuerUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

/**
 * Create identity provider admin routes.
 * @param db - Database client
 * @param encryptionKey - Credential encryption key
 */
export function createIdentityProviderRoutes(db: Database, encryptionKey: string): RouterType {
  const router: RouterType = Router();

  // ─── Generic Identity Providers ────────────────────────────────────

  /** GET /api/admin/identity-providers — List configured IdPs */
  router.get('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const result = await db
      .select({
        id: identityProviders.id,
        name: identityProviders.name,
        slug: identityProviders.slug,
        protocol: identityProviders.protocol,
        attributeMapping: identityProviders.attributeMapping,
        isActive: identityProviders.isActive,
        createdAt: identityProviders.createdAt,
      })
      .from(identityProviders)
      .where(and(eq(identityProviders.tenantId, tenantId), isNull(identityProviders.deletedAt)));

    res.json({ success: true, data: result });
  });

  /** POST /api/admin/identity-providers — Create IdP */
  router.post('/', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const body = createIdpSchema.parse(req.body);

    const encrypted = encryptJson(body.config, encryptionKey);

    const [created] = await db
      .insert(identityProviders)
      .values({
        tenantId,
        name: body.name,
        slug: body.slug,
        protocol: body.protocol,
        config: encrypted,
        attributeMapping: body.attributeMapping,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: { ...created, config: undefined },
    });
  });

  /** GET /api/admin/identity-providers/:id — Get IdP (secrets redacted) */
  router.get('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    const [idp] = await db
      .select({
        id: identityProviders.id,
        name: identityProviders.name,
        slug: identityProviders.slug,
        protocol: identityProviders.protocol,
        attributeMapping: identityProviders.attributeMapping,
        isActive: identityProviders.isActive,
        createdAt: identityProviders.createdAt,
      })
      .from(identityProviders)
      .where(and(eq(identityProviders.id, id), eq(identityProviders.tenantId, tenantId)));

    if (!idp) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Identity provider not found', 404);
    }

    res.json({ success: true, data: idp });
  });

  /** PATCH /api/admin/identity-providers/:id — Update IdP */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);
    const body = updateIdpSchema.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.attributeMapping !== undefined) updates.attributeMapping = body.attributeMapping;
    if (body.config !== undefined) updates.config = encryptJson(body.config, encryptionKey);

    const [updated] = await db
      .update(identityProviders)
      .set(updates)
      .where(and(eq(identityProviders.id, id), eq(identityProviders.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Identity provider not found', 404);
    }

    res.json({ success: true, data: { ...updated, config: undefined } });
  });

  /** DELETE /api/admin/identity-providers/:id — Remove IdP */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const id = String(req.params.id);

    await db
      .update(identityProviders)
      .set({ deletedAt: new Date() })
      .where(and(eq(identityProviders.id, id), eq(identityProviders.tenantId, tenantId)));

    res.status(204).send();
  });

  // ─── SSO Config (OIDC-specific, per tenant) ───────────────────────

  /** GET /api/admin/sso — Get SSO config for tenant */
  router.get('/sso/config', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;

    const [config] = await db
      .select({
        id: ssoConfigs.id,
        providerName: ssoConfigs.providerName,
        issuerUrl: ssoConfigs.issuerUrl,
        clientId: ssoConfigs.clientId,
        isActive: ssoConfigs.isActive,
        createdAt: ssoConfigs.createdAt,
      })
      .from(ssoConfigs)
      .where(eq(ssoConfigs.tenantId, tenantId));

    res.json({ success: true, data: config ?? null });
  });

  /** PUT /api/admin/sso/config — Create or update SSO config */
  router.put('/sso/config', async (req: Request, res: Response) => {
    const { tenantId } = req as TenantScopedRequest;
    const body = upsertSsoSchema.parse(req.body);

    const encryptedSecret = encrypt(body.clientSecret, encryptionKey);

    // Check if config exists
    const [existing] = await db
      .select()
      .from(ssoConfigs)
      .where(eq(ssoConfigs.tenantId, tenantId));

    let result;
    if (existing) {
      [result] = await db
        .update(ssoConfigs)
        .set({
          providerName: body.providerName,
          issuerUrl: body.issuerUrl,
          clientId: body.clientId,
          clientSecretEnc: encryptedSecret,
        })
        .where(eq(ssoConfigs.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(ssoConfigs)
        .values({
          tenantId,
          providerName: body.providerName,
          issuerUrl: body.issuerUrl,
          clientId: body.clientId,
          clientSecretEnc: encryptedSecret,
        })
        .returning();
    }

    res.json({
      success: true,
      data: { ...result, clientSecretEnc: undefined },
    });
  });

  return router;
}
