/**
 * Authentication service — handles local login, JWT issuance, token refresh, and logout.
 * OIDC/SSO flows terminate here after the external callback, issuing the same JWT pair.
 * @module api-server/services/authService
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { users, refreshTokens } from '../db/schema.js';
import { AppError, ErrorCode } from '../errors.js';
import type { JwtPayload } from '../middleware/auth.js';
import { fetchUserVenueIds } from '../middleware/permissions.js';

/** Bcrypt cost factor — minimum 12 per auth addendum */
const BCRYPT_COST = 12;
/** Access token lifetime */
const ACCESS_TOKEN_EXPIRY = '15m';
/** Refresh token lifetime (14 days per auth addendum) */
const REFRESH_TOKEN_EXPIRY_DAYS = 14;

/**
 * Hash a refresh token for secure storage.
 * Uses SHA-256 so we can look up by hash without storing the raw token.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Authentication service for user login, token issuance, and refresh.
 */
export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
  ) {}

  /**
   * Authenticate a user with email and password (local auth).
   * @param email - User email
   * @param password - Plaintext password
   * @returns JWT access token, refresh token, and user info
   */
  async login(email: string, password: string) {
    // Find active user by email
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));

    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Account is disabled', 403);
    }

    // SSO-only users cannot log in with a password
    if (!user.hashedPassword) {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'This account uses SSO. Please log in through your identity provider.',
        401,
      );
    }

    const passwordValid = await bcrypt.compare(password, user.hashedPassword);
    if (!passwordValid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid email or password', 401);
    }

    // Update last login
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    // Issue tokens
    const accessToken = this.issueAccessToken(user);
    const { token: refreshToken, expiresAt } = this.generateRefreshToken();

    // Store refresh token hash in DB
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    // Fetch venue assignments for the response
    const venueIds = await fetchUserVenueIds(this.db, user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        venueIds,
      },
    };
  }

  /**
   * Issue tokens for an SSO-authenticated user (called after OIDC callback).
   * Creates the user record if it doesn't exist.
   * @param email - Email claim from IdP
   * @param externalId - Subject/nameID from IdP
   * @param authProvider - Identity provider slug
   * @param tenantId - Tenant UUID (resolved from SSO config)
   * @returns JWT access token, refresh token, and user info
   */
  async loginSso(email: string, externalId: string, authProvider: string, tenantId: string) {
    // Find or create user
    let [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));

    if (!user) {
      // Auto-provision on first SSO login
      const [newUser] = await this.db
        .insert(users)
        .values({
          tenantId,
          email,
          authProvider,
          externalId,
          role: 'venue_operator',
        })
        .returning();
      user = newUser;
    } else {
      // Update SSO fields and last login
      await this.db
        .update(users)
        .set({ authProvider, externalId, lastLoginAt: new Date() })
        .where(eq(users.id, user.id));
    }

    if (!user.isActive) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Account is disabled', 403);
    }

    const accessToken = this.issueAccessToken(user);
    const { token: refreshToken, expiresAt } = this.generateRefreshToken();

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    const venueIds = await fetchUserVenueIds(this.db, user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        venueIds,
      },
    };
  }

  /**
   * Refresh an access token using a valid refresh token.
   * Implements token rotation: the old refresh token is revoked and a new one is issued.
   * @param rawRefreshToken - The refresh token string
   * @returns New access token and refresh token
   */
  async refresh(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    // Find the refresh token record
    const [record] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));

    if (!record) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid refresh token', 401);
    }

    if (record.revokedAt !== null) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Refresh token has been revoked', 401);
    }

    if (new Date() > record.expiresAt) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Refresh token has expired', 401);
    }

    // Revoke the old token (rotation)
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, record.id));

    // Fetch the user
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, record.userId));

    if (!user || !user.isActive) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Account is disabled or not found', 403);
    }

    // Issue new tokens
    const accessToken = this.issueAccessToken(user);
    const { token: newRefreshToken, expiresAt } = this.generateRefreshToken();

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout by revoking a refresh token.
   * @param rawRefreshToken - The refresh token to revoke
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  /**
   * Hash a password for storage.
   * @param password - Plaintext password
   * @returns Bcrypt hash
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  /**
   * Issue a signed JWT access token for a user.
   */
  private issueAccessToken(user: { id: string; email: string; role: string; tenantId: string }): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      tenantId: user.tenantId,
    };

    return jwt.sign(payload, this.accessSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  /**
   * Generate a random refresh token and its expiry date.
   */
  private generateRefreshToken(): { token: string; expiresAt: Date } {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    return { token, expiresAt };
  }
}
