/**
 * End-user control routes — public, unauthenticated but token-gated.
 * Guests access these via QR code to control in-suite TVs and devices.
 * Every request validates the group access token and enforces rate limiting.
 * @module api-server/routes/control
 */

import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import {
  groupAccessTokens,
  groups,
  groupEndpoints,
  endpoints,
  channels,
  venues,
  brandingConfigs,
  controllers,
  auditLog,
} from '../../db/schema.js';
import type { BridgeClient } from '../../services/bridgeClient.js';
import type { StateCache } from '../../services/stateCache.js';
import { isTokenCurrentlyValid } from '../../utils/tokenValidity.js';
import { decryptJson } from '../../utils/encryption.js';
import { AppError, ErrorCode } from '../../errors.js';
import type { ControlCommandType } from '@suitecommand/types';

const commandSchema = z.object({
  endpointId: z.string().uuid(),
  commandType: z.enum(['POWER', 'INPUT', 'VOLUME', 'CHANNEL', 'MUTE']),
  payload: z.record(z.unknown()),
});

/**
 * Resolve and validate a group access token from the URL path.
 * Returns the full token record, group, and venue with timezone.
 */
async function resolveToken(db: Database, tokenStr: string) {
  const [tokenRecord] = await db
    .select()
    .from(groupAccessTokens)
    .where(eq(groupAccessTokens.token, tokenStr));

  if (!tokenRecord) {
    throw new AppError(ErrorCode.TOKEN_INVALID, 'Invalid access token', 403);
  }

  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, tokenRecord.groupId), isNull(groups.deletedAt)));

  if (!group) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Group not found', 404);
  }

  const [venue] = await db
    .select()
    .from(venues)
    .where(eq(venues.id, group.venueId));

  if (!venue) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Venue not found', 404);
  }

  // Check token validity
  const tokenForValidation = {
    ...tokenRecord,
    accessTier: tokenRecord.accessTier as 'event' | 'seasonal' | 'permanent',
    validFrom: tokenRecord.validFrom?.toISOString() ?? null,
    validUntil: tokenRecord.validUntil?.toISOString() ?? null,
    rotatedAt: tokenRecord.rotatedAt?.toISOString() ?? null,
    eventId: tokenRecord.eventId,
    createdAt: tokenRecord.createdAt.toISOString(),
  };

  if (!isTokenCurrentlyValid(tokenForValidation, venue.timezone)) {
    throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Access has expired', 403);
  }

  return { tokenRecord, group, venue };
}

/**
 * Create control routes (public, token-gated).
 * @param db - Database client
 * @param bridgeClient - Bridge agent client
 * @param stateCache - Redis state cache for rate limiting and pub/sub
 * @param encryptionKey - Credential decryption key
 */
export function createControlRoutes(
  db: Database,
  bridgeClient: BridgeClient,
  stateCache: StateCache,
  encryptionKey: string,
): RouterType {
  const router: RouterType = Router();

  /**
   * GET /api/control/:groupToken
   * Get group configuration: endpoints, channels, and branding for the control UI.
   */
  router.get('/:groupToken', async (req: Request, res: Response) => {
    const tokenStr = String(req.params.groupToken);
    const { group, venue } = await resolveToken(db, tokenStr);

    // Fetch endpoints in this group
    const groupEps = await db
      .select({
        id: endpoints.id,
        platformEndpointId: endpoints.platformEndpointId,
        displayName: endpoints.displayName,
        deviceType: endpoints.deviceType,
        currentState: endpoints.currentState,
        displayOrder: groupEndpoints.displayOrder,
      })
      .from(groupEndpoints)
      .innerJoin(endpoints, eq(groupEndpoints.endpointId, endpoints.id))
      .where(eq(groupEndpoints.groupId, group.id))
      .orderBy(groupEndpoints.displayOrder);

    // Fetch channels for this venue
    const venueChannels = await db
      .select({
        id: channels.id,
        displayName: channels.displayName,
        logoUrl: channels.logoUrl,
        channelNumber: channels.channelNumber,
        category: channels.category,
      })
      .from(channels)
      .where(and(eq(channels.venueId, venue.id), eq(channels.isActive, true)))
      .orderBy(channels.displayOrder);

    // Fetch branding
    const [branding] = await db
      .select()
      .from(brandingConfigs)
      .where(eq(brandingConfigs.venueId, venue.id));

    res.json({
      success: true,
      data: {
        group: { id: group.id, name: group.name, type: group.type },
        endpoints: groupEps,
        channels: venueChannels,
        branding: branding ?? null,
      },
    });
  });

  /**
   * POST /api/control/:groupToken/command
   * Send a control command to an endpoint. Rate-limited per token+IP.
   */
  router.post('/:groupToken/command', async (req: Request, res: Response) => {
    const tokenStr = String(req.params.groupToken);
    const { tokenRecord, group, venue } = await resolveToken(db, tokenStr);

    // Rate limit
    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const withinLimit = await stateCache.checkRateLimit(tokenRecord.id, clientIp);
    if (!withinLimit) {
      throw new AppError(ErrorCode.RATE_LIMITED, 'Too many commands. Please wait.', 429);
    }

    const body = commandSchema.parse(req.body);

    // Verify the endpoint belongs to this group
    const [groupEp] = await db
      .select({ endpoint: endpoints })
      .from(groupEndpoints)
      .innerJoin(endpoints, eq(groupEndpoints.endpointId, endpoints.id))
      .where(
        and(
          eq(groupEndpoints.groupId, group.id),
          eq(groupEndpoints.endpointId, body.endpointId),
        ),
      );

    if (!groupEp) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Endpoint not in this group', 404);
    }

    // Get the controller for this endpoint to get connection config
    const [controller] = await db
      .select()
      .from(controllers)
      .where(eq(controllers.id, groupEp.endpoint.controllerId));

    if (!controller) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Controller not found for endpoint', 500);
    }

    const connectionConfig = decryptJson<Record<string, unknown>>(
      controller.connectionConfig,
      encryptionKey,
    );

    // Send command via bridge agent
    const state = await bridgeClient.sendCommand(
      controller.id,
      {
        commandType: body.commandType as ControlCommandType,
        platformEndpointId: groupEp.endpoint.platformEndpointId,
        payload: body.payload as never,
      },
      controller.platformSlug,
      { platform: controller.platformSlug, ...connectionConfig },
    );

    // Update cached state
    await stateCache.setEndpointState(body.endpointId, group.id, state);

    // Update DB state
    await db
      .update(endpoints)
      .set({
        currentState: {
          isPoweredOn: state.isPoweredOn,
          currentInput: state.currentInput,
          currentChannelNumber: state.currentChannelNumber,
          volumeLevel: state.volumeLevel,
          isMuted: state.isMuted,
        },
        lastSeenAt: new Date(),
      })
      .where(eq(endpoints.id, body.endpointId));

    // Audit log
    await db.insert(auditLog).values({
      tenantId: venue.tenantId,
      action: 'control_command',
      entityType: 'group_access_token',
      entityId: tokenRecord.id,
      payload: {
        commandType: body.commandType,
        endpointId: body.endpointId,
        ip: clientIp,
      },
    });

    res.json({
      success: true,
      data: {
        endpointId: body.endpointId,
        state,
      },
    });
  });

  return router;
}
