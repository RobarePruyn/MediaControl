/**
 * Development seed script for SuiteCommand.
 * Creates a default tenant, venue, admin user, controller, groups, channels,
 * event, access tokens, trigger, and branding config for local development.
 *
 * Usage: tsx scripts/seed-dev.ts
 * Idempotent — skips seeding if the "demo" tenant already exists.
 *
 * @module scripts/seed-dev
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import bcrypt from 'bcrypt';

import * as schema from '../services/api-server/src/db/schema.js';
import { encryptJson } from '../services/api-server/src/utils/encryption.js';
import { generateAccessToken } from '../services/api-server/src/utils/tokenGenerator.js';

const { Pool } = pg;

// ─── Configuration ────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://suitecommand:suitecommand_dev@localhost:5432/suitecommand';

/**
 * Default encryption key for dev seeding (hex-encoded 256-bit key).
 * In production this MUST come from CREDENTIAL_ENCRYPTION_KEY env var.
 */
const CREDENTIAL_ENCRYPTION_KEY =
  process.env.CREDENTIAL_ENCRYPTION_KEY ??
  'a03f8b2e1c4d5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b';

const BCRYPT_ROUNDS = 12;

// ─── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('SuiteCommand Dev Seed');
  console.log('=====================');
  console.log(`Database: ${DATABASE_URL.replace(/\/\/.*@/, '//<redacted>@')}`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    // Idempotency check — skip if "demo" tenant already exists
    const existing = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, 'demo'))
      .limit(1);

    if (existing.length > 0) {
      console.log('\nTenant "demo" already exists — skipping seed. Delete it first to re-seed.');
      return;
    }

    // ─── IDs (pre-generated so we can cross-reference) ────────────────

    const tenantId = randomUUID();
    const venueId = randomUUID();
    const userId = randomUUID();
    const controllerId = randomUUID();
    const groupSuite100Id = randomUUID();
    const groupSuite200Id = randomUUID();
    const groupBohId = randomUUID();
    const eventId = randomUUID();
    const triggerId = randomUUID();
    const brandingId = randomUUID();

    // ─── 1. Tenant ────────────────────────────────────────────────────

    await db.insert(schema.tenants).values({
      id: tenantId,
      name: 'Demo Venue Group',
      slug: 'demo',
      planTier: 'professional',
      isActive: true,
    });
    console.log('  Created tenant: Demo Venue Group (demo)');

    // ─── 2. Venue ─────────────────────────────────────────────────────

    await db.insert(schema.venues).values({
      id: venueId,
      tenantId,
      name: 'Demo Arena',
      slug: 'demo-arena',
      timezone: 'America/New_York',
    });
    console.log('  Created venue: Demo Arena');

    // ─── 3. Admin User ────────────────────────────────────────────────

    const hashedPassword = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
    await db.insert(schema.users).values({
      id: userId,
      tenantId,
      email: 'admin@suitecommand.local',
      hashedPassword,
      role: 'super_admin',
      isActive: true,
    });
    console.log('  Created user: admin@suitecommand.local (super_admin)');

    // ─── 3b. Additional Test Users ──────────────────────────────────

    const venueAdminId = randomUUID();
    const venueOperatorId = randomUUID();

    const hashedPassword2 = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
    await db.insert(schema.users).values([
      {
        id: venueAdminId,
        tenantId,
        email: 'venueadmin@suitecommand.local',
        hashedPassword: hashedPassword2,
        role: 'venue_super_admin',
        isActive: true,
      },
      {
        id: venueOperatorId,
        tenantId,
        email: 'operator@suitecommand.local',
        hashedPassword: hashedPassword2,
        role: 'venue_operator',
        isActive: true,
      },
    ]);
    console.log('  Created user: venueadmin@suitecommand.local (venue_super_admin)');
    console.log('  Created user: operator@suitecommand.local (venue_operator)');

    // ─── 3c. User-Venue Assignments ──────────────────────────────────

    await db.insert(schema.userVenues).values([
      { userId: venueAdminId, venueId },
      { userId: venueOperatorId, venueId },
    ]);
    console.log('  Assigned venueadmin and operator to Demo Arena');

    // ─── 4. Controller ────────────────────────────────────────────────

    const connectionConfig = encryptJson(
      {
        platform: 'visionedge',
        baseUrl: 'https://10.194.175.122',
        pin: '4444574',
      },
      CREDENTIAL_ENCRYPTION_KEY,
    );

    await db.insert(schema.controllers).values({
      id: controllerId,
      venueId,
      name: 'Main VisionEdge',
      platformSlug: 'visionedge',
      connectionConfig,
      isActive: true,
      pollIntervalSeconds: 300,
    });
    console.log('  Created controller: Main VisionEdge (visionedge)');

    // ─── 5. Groups ────────────────────────────────────────────────────

    const groupsData = [
      { id: groupSuite100Id, name: 'Suite 100', type: 'suite' as const },
      { id: groupSuite200Id, name: 'Suite 200', type: 'suite' as const },
      { id: groupBohId, name: 'BOH Control', type: 'boh' as const },
    ];

    await db.insert(schema.groups).values(
      groupsData.map((g) => ({
        id: g.id,
        venueId,
        name: g.name,
        type: g.type,
      })),
    );
    console.log('  Created groups: Suite 100, Suite 200, BOH Control');

    // ─── 6. Event ─────────────────────────────────────────────────────

    const now = new Date();
    const startsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    const endsAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); // +5 hours

    await db.insert(schema.events).values({
      id: eventId,
      venueId,
      name: 'Game Night',
      startsAt,
      endsAt,
      preAccessMinutes: 60,
      postAccessMinutes: 30,
    });
    console.log('  Created event: Game Night');

    // ─── 7. Group Access Tokens ───────────────────────────────────────

    const tokensData = [
      { groupId: groupSuite100Id, accessTier: 'seasonal' as const },
      { groupId: groupSuite200Id, accessTier: 'seasonal' as const },
      { groupId: groupBohId, accessTier: 'permanent' as const },
    ];

    const tokenValues = tokensData.map((t) => ({
      id: randomUUID(),
      groupId: t.groupId,
      token: generateAccessToken(20),
      accessTier: t.accessTier,
      isActive: true,
    }));

    await db.insert(schema.groupAccessTokens).values(tokenValues);
    for (const tv of tokenValues) {
      const group = groupsData.find((g) => g.id === tv.groupId);
      console.log(`  Created access token for ${group?.name}: ${tv.token} (${tv.accessTier})`);
    }

    // ─── 8. Channels ─────────────────────────────────────────────────

    const channelsData = [
      { name: 'ESPN', number: '206', category: 'Sports' },
      { name: 'FOX', number: '5', category: 'Broadcast' },
      { name: 'NBC', number: '4', category: 'Broadcast' },
      { name: 'CBS', number: '2', category: 'Broadcast' },
      { name: 'NFL Network', number: '219', category: 'Sports' },
    ];

    await db.insert(schema.channels).values(
      channelsData.map((ch, idx) => ({
        id: randomUUID(),
        venueId,
        platformChannelId: ch.number,
        displayName: ch.name,
        channelNumber: ch.number,
        category: ch.category,
        isActive: true,
        displayOrder: idx,
      })),
    );
    console.log(`  Created ${channelsData.length} channels: ${channelsData.map((c) => c.name).join(', ')}`);

    // ─── 9. Trigger ──────────────────────────────────────────────────

    await db.insert(schema.triggers).values({
      id: triggerId,
      venueId,
      name: 'Game Day Mode',
      description: 'Set all suite TVs to house channel',
      isActive: true,
      createdBy: userId,
    });
    console.log('  Created trigger: Game Day Mode');

    // ─── 10. Branding Config ─────────────────────────────────────────

    await db.insert(schema.brandingConfigs).values({
      id: brandingId,
      venueId,
      primaryColor: '#1e3a5f',
      secondaryColor: '#0a1628',
      accentColor: '#c8a961',
      textOnPrimary: '#ffffff',
      textOnSecondary: '#e1e4ed',
      fontFamily: 'Inter, sans-serif',
      buttonRadius: '8px',
    });
    console.log('  Created branding config for Demo Arena');

    // ─── Summary ─────────────────────────────────────────────────────

    console.log('\nSeed complete!');
    console.log('─────────────');
    console.log(`  Tenant ID:     ${tenantId}`);
    console.log(`  Venue ID:      ${venueId}`);
    console.log(`  Admin User ID: ${userId}`);
    console.log(`  Login:         admin@suitecommand.local / admin123`);
    console.log(`  Controller ID: ${controllerId}`);
    console.log(`  Event ID:      ${eventId}`);
    console.log(`  Trigger ID:    ${triggerId}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
