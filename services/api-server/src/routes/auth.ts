/**
 * Authentication routes — local login, token refresh, logout, and OIDC SSO initiation/callback.
 * SSO flows terminate by issuing the same JWT pair as local login.
 * @module api-server/routes/auth
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import * as openidClient from 'openid-client';
import { eq, and } from 'drizzle-orm';

import type { AuthService } from '../services/authService.js';
import type { Database } from '../db/client.js';
import { ssoConfigs } from '../db/schema.js';
import { decrypt } from '../utils/encryption.js';
import type { Config } from '../config.js';

/** Zod schema for login request */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Zod schema for refresh request */
const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Zod schema for logout request */
const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

/**
 * Create auth routes with injected dependencies.
 * @param authService - Authentication service instance
 * @param db - Database client
 * @param config - Application config
 * @returns Express router with auth routes
 */
export function createAuthRoutes(
  authService: AuthService,
  db: Database,
  config: Config,
): RouterType {
  const router: RouterType = Router();

  /**
   * POST /api/auth/login
   * Authenticate with email and password. Returns JWT access/refresh tokens.
   */
  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json({ success: true, data: result });
  });

  /**
   * POST /api/auth/refresh
   * Exchange a valid refresh token for new access and refresh tokens.
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.json({ success: true, data: result });
  });

  /**
   * POST /api/auth/logout
   * Revoke a refresh token.
   */
  router.post('/logout', async (req: Request, res: Response) => {
    const { refreshToken } = logoutSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  });

  /**
   * GET /api/auth/sso/:providerSlug
   * Initiate OIDC login flow. Redirects the user to the identity provider.
   */
  router.get('/sso/:providerSlug', async (req: Request, res: Response) => {
    const providerSlug = String(req.params.providerSlug);

    // Look up SSO config
    const [ssoConfig] = await db
      .select()
      .from(ssoConfigs)
      .where(and(eq(ssoConfigs.isActive, true)));

    if (!ssoConfig?.issuerUrl || !ssoConfig?.clientId || !ssoConfig?.clientSecretEnc) {
      res.status(404).json({
        success: false,
        error: { code: 'SSO_NOT_CONFIGURED', message: `SSO provider '${providerSlug}' not found or not configured` },
      });
      return;
    }

    const clientSecret = decrypt(ssoConfig.clientSecretEnc, config.CREDENTIAL_ENCRYPTION_KEY);
    const redirectUri = `${config.HOST}/api/auth/oidc/callback`;

    const oidcConfig = await openidClient.discovery(
      new URL(ssoConfig.issuerUrl),
      ssoConfig.clientId,
      clientSecret,
    );

    const codeVerifier = openidClient.randomPKCECodeVerifier();
    const codeChallenge = await openidClient.calculatePKCECodeChallenge(codeVerifier);

    // Store code verifier in a short-lived cookie for the callback
    res.cookie('oidc_verifier', codeVerifier, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      maxAge: 600_000,
      sameSite: 'lax',
    });

    // Store tenant context for callback
    res.cookie('oidc_tenant', ssoConfig.tenantId, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      maxAge: 600_000,
      sameSite: 'lax',
    });

    const params = new URLSearchParams({
      client_id: ssoConfig.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${oidcConfig.serverMetadata().authorization_endpoint}?${params.toString()}`;
    res.redirect(authUrl);
  });

  /**
   * GET /api/auth/oidc/callback
   * OIDC callback endpoint. Exchanges the authorization code for tokens,
   * resolves the user, and issues a SuiteCommand JWT pair.
   */
  router.get('/oidc/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const codeVerifier = req.cookies?.oidc_verifier as string | undefined;
    const tenantId = req.cookies?.oidc_tenant as string | undefined;

    if (!code || !codeVerifier || !tenantId) {
      res.status(400).json({
        success: false,
        error: { code: 'OIDC_CALLBACK_ERROR', message: 'Missing authorization code or session state' },
      });
      return;
    }

    // Look up SSO config for the tenant
    const [ssoConfig] = await db
      .select()
      .from(ssoConfigs)
      .where(and(eq(ssoConfigs.tenantId, tenantId), eq(ssoConfigs.isActive, true)));

    if (!ssoConfig?.issuerUrl || !ssoConfig?.clientId || !ssoConfig?.clientSecretEnc) {
      res.status(500).json({
        success: false,
        error: { code: 'SSO_NOT_CONFIGURED', message: 'SSO configuration missing for tenant' },
      });
      return;
    }

    const clientSecret = decrypt(ssoConfig.clientSecretEnc, config.CREDENTIAL_ENCRYPTION_KEY);
    const redirectUri = `${config.HOST}/api/auth/oidc/callback`;

    const oidcConfig = await openidClient.discovery(
      new URL(ssoConfig.issuerUrl),
      ssoConfig.clientId,
      clientSecret,
    );

    // Exchange code for tokens
    const tokens = await openidClient.authorizationCodeGrant(oidcConfig, new URL(req.url, config.HOST), {
      pkceCodeVerifier: codeVerifier,
      expectedState: undefined,
    });

    const claims = tokens.claims();
    if (!claims?.email) {
      res.status(400).json({
        success: false,
        error: { code: 'OIDC_NO_EMAIL', message: 'Identity provider did not return an email claim' },
      });
      return;
    }

    const email = claims.email as string;
    const externalId = claims.sub ?? '';
    const providerSlug = ssoConfig.providerName ?? 'oidc';

    // Issue SuiteCommand JWT pair
    const result = await authService.loginSso(email, externalId, providerSlug, tenantId);

    // Clear OIDC session cookies
    res.clearCookie('oidc_verifier');
    res.clearCookie('oidc_tenant');

    // Redirect to admin UI with tokens as query params
    // The admin UI will extract and store them
    const adminUrl = new URL('/admin/auth/callback', config.HOST);
    adminUrl.searchParams.set('accessToken', result.accessToken);
    adminUrl.searchParams.set('refreshToken', result.refreshToken);
    res.redirect(adminUrl.toString());
  });

  return router;
}
