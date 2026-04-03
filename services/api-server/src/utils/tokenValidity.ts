/**
 * Token validity logic for group access tokens.
 * Shared utility used by control route handlers and WebSocket connection handlers.
 * Must be called on every page load, every command, and every WebSocket connect.
 * @module api-server/utils/tokenValidity
 */

import { addDays, set } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { GroupAccessToken } from '@suitecommand/types';

/** Hard daily ceiling hour for event-tier tokens (local venue time) */
const DAILY_CEILING_HOUR = 3;

/** Grace window in milliseconds for existing WebSocket connections after token expiry */
export const WS_GRACE_WINDOW_MS = 45 * 60 * 1000;

/**
 * Determines whether a group access token is currently valid.
 * Enforces both the scheduled validity window and the hard 3 AM daily ceiling
 * for event-tier tokens. Venue timezone is used for the ceiling calculation
 * so that rotation always occurs at 3 AM *local* time regardless of server timezone.
 *
 * @param token - The GroupAccessToken record from the database
 * @param venueTimezone - IANA timezone string, e.g. "America/New_York"
 * @returns true if the token is valid and commands should be accepted
 */
export function isTokenCurrentlyValid(
  token: GroupAccessToken,
  venueTimezone: string,
): boolean {
  // Revoked or superseded tokens are always invalid regardless of tier
  if (!token.isActive || token.rotatedAt !== null) {
    return false;
  }

  // Seasonal and permanent tiers have no time-based expiry — admin rotation only
  if (token.accessTier === 'seasonal' || token.accessTier === 'permanent') {
    return true;
  }

  // Event-tier: enforce both the event window AND the hard 3 AM daily ceiling
  const now = new Date();

  // Event-tier token with no event attached is never valid
  // (prevents orphaned tokens from granting access)
  if (token.eventId === null) {
    return false;
  }

  // Check scheduled validity window if present
  const afterValidFrom = token.validFrom === null || now >= new Date(token.validFrom);
  const beforeValidUntil = token.validUntil === null || now <= new Date(token.validUntil);
  const withinEventWindow = afterValidFrom && beforeValidUntil;

  // Hard ceiling: 3:00 AM local time. Use the venue's timezone.
  const localNow = toZonedTime(now, venueTimezone);
  const todayCeiling = set(localNow, {
    hours: DAILY_CEILING_HOUR,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  // If before 3 AM today — ceiling is tonight at 3 AM
  // If after 3 AM today — ceiling is tomorrow at 3 AM
  const activeCeiling = localNow < todayCeiling
    ? todayCeiling
    : addDays(todayCeiling, 1);
  const beforeDailyCeiling = localNow < activeCeiling;

  return withinEventWindow && beforeDailyCeiling;
}

/**
 * Check if a WebSocket connection established at the given time should still
 * be allowed after its token has expired, using the 45-minute grace window.
 *
 * @param connectionEstablishedAt - When the WebSocket connection was opened
 * @param token - The GroupAccessToken record
 * @param venueTimezone - IANA timezone string
 * @returns true if the connection is within the grace period
 */
export function isWithinWsGraceWindow(
  connectionEstablishedAt: Date,
  token: GroupAccessToken,
  venueTimezone: string,
): boolean {
  // If the token is still valid, no need for grace logic
  if (isTokenCurrentlyValid(token, venueTimezone)) {
    return true;
  }

  // Allow grace window only if the token was valid when the connection was established
  const elapsed = Date.now() - connectionEstablishedAt.getTime();
  return elapsed <= WS_GRACE_WINDOW_MS;
}
