/**
 * Daily token rotation cron job.
 * Runs every 15 minutes server-side, checks per-venue whether current time
 * is in the 2:55–3:00 AM window for that venue's timezone. Rotates event-tier
 * tokens and pre-generates new ones for upcoming events.
 * @module api-server/services/tokenRotationJob
 */

import cron from 'node-cron';
import { toZonedTime } from 'date-fns-tz';
import { addDays } from 'date-fns';
import { eq, and, isNull, gte, lte } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { venues, events, groupAccessTokens, groups, auditLog } from '../db/schema.js';
import { generateAccessToken } from '../utils/tokenGenerator.js';

/** Rotation window: 2:55 AM to 3:00 AM local time */
const ROTATION_WINDOW_START_HOUR = 2;
const ROTATION_WINDOW_START_MINUTE = 55;
const ROTATION_WINDOW_END_HOUR = 3;
const ROTATION_WINDOW_END_MINUTE = 0;

/**
 * Check if the current time is within the 2:55–3:00 AM window for a given timezone.
 * @param timezone - IANA timezone string
 * @returns true if we should rotate tokens for this venue now
 */
function isInRotationWindow(timezone: string): boolean {
  const localNow = toZonedTime(new Date(), timezone);
  const hours = localNow.getHours();
  const minutes = localNow.getMinutes();

  // 2:55 to 2:59
  if (hours === ROTATION_WINDOW_START_HOUR && minutes >= ROTATION_WINDOW_START_MINUTE) {
    return true;
  }
  // 3:00
  if (hours === ROTATION_WINDOW_END_HOUR && minutes <= ROTATION_WINDOW_END_MINUTE) {
    return true;
  }

  return false;
}

/**
 * Start the token rotation cron job.
 * Runs every 15 minutes and processes each venue whose local time falls
 * within the 2:55–3:00 AM rotation window.
 * @param db - Database client
 */
export function startTokenRotationJob(db: Database): void {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await runRotation(db);
    } catch (error) {
      console.error('[TokenRotation] Job failed:', error instanceof Error ? error.message : error);
    }
  });

  console.log('[TokenRotation] Cron job scheduled (every 15 minutes)');
}

/**
 * Execute a single rotation pass across all venues.
 * Exported for testing.
 * @param db - Database client
 */
export async function runRotation(db: Database): Promise<void> {
  // Fetch all active venues with their timezones
  const allVenues = await db
    .select({ id: venues.id, timezone: venues.timezone, tenantId: venues.tenantId })
    .from(venues)
    .where(isNull(venues.deletedAt));

  for (const venue of allVenues) {
    if (!isInRotationWindow(venue.timezone)) {
      continue;
    }

    console.log(`[TokenRotation] Processing venue ${venue.id} (tz: ${venue.timezone})`);

    let rotatedCount = 0;
    let generatedCount = 0;

    // 1. Find all active event-tier tokens for this venue
    const venueGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.venueId, venue.id), isNull(groups.deletedAt)));

    const groupIds = venueGroups.map((g) => g.id);

    if (groupIds.length === 0) continue;

    for (const groupId of groupIds) {
      // Find active event-tier tokens
      const activeTokens = await db
        .select()
        .from(groupAccessTokens)
        .where(
          and(
            eq(groupAccessTokens.groupId, groupId),
            eq(groupAccessTokens.accessTier, 'event'),
            eq(groupAccessTokens.isActive, true),
            isNull(groupAccessTokens.rotatedAt),
          ),
        );

      // 2. Rotate each active event-tier token
      for (const token of activeTokens) {
        await db
          .update(groupAccessTokens)
          .set({ rotatedAt: new Date(), isActive: false })
          .where(eq(groupAccessTokens.id, token.id));
        rotatedCount++;
      }
    }

    // 3. Find events starting within the next 24 hours
    const now = new Date();
    const tomorrow = addDays(now, 1);

    const upcomingEvents = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.venueId, venue.id),
          gte(events.startsAt, now),
          lte(events.startsAt, tomorrow),
          isNull(events.deletedAt),
        ),
      );

    // 4. For each group, pre-generate tokens for upcoming events
    for (const event of upcomingEvents) {
      for (const groupId of groupIds) {
        const validFrom = new Date(event.startsAt.getTime() - event.preAccessMinutes * 60_000);
        const validUntil = new Date(event.endsAt.getTime() + event.postAccessMinutes * 60_000);

        await db.insert(groupAccessTokens).values({
          groupId,
          token: generateAccessToken(),
          accessTier: 'event',
          validFrom,
          validUntil,
          eventId: event.id,
          isActive: true,
        });
        generatedCount++;
      }
    }

    // 5. Write audit log
    if (rotatedCount > 0 || generatedCount > 0) {
      await db.insert(auditLog).values({
        tenantId: venue.tenantId,
        action: 'token_rotation',
        entityType: 'venue',
        entityId: venue.id,
        payload: { rotatedCount, generatedCount, eventCount: upcomingEvents.length },
      });

      console.log(
        `[TokenRotation] Venue ${venue.id}: rotated ${rotatedCount}, generated ${generatedCount}`,
      );
    }
  }
}
