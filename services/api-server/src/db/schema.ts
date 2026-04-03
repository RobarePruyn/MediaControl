/**
 * Drizzle ORM schema definition for the SuiteCommand database.
 * All tables use UUID primary keys. Soft-delete via deleted_at is preferred.
 * @module api-server/db/schema
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Enums ─────────────────────────────────────────────────────────────

export const planTierEnum = pgEnum('plan_tier', ['basic', 'professional', 'enterprise']);
export const userRoleEnum = pgEnum('user_role', ['meta_admin', 'site_admin', 'operator']);
export const groupTypeEnum = pgEnum('group_type', ['suite', 'room', 'zone', 'boh']);

// ─── Tenants ───────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  planTier: planTierEnum('plan_tier').notNull().default('basic'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─── Venues ────────────────────────────────────────────────────────────

export const venues = pgTable('venues', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 20 }),
  secondaryColor: varchar('secondary_color', { length: 20 }),
  accentColor: varchar('accent_color', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('venues_tenant_id_idx').on(table.tenantId),
]);

// ─── Branding Configs ──────────────────────────────────────────────────

export const brandingConfigs = pgTable('branding_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueId: uuid('venue_id').notNull().references(() => venues.id).unique(),
  primaryColor: varchar('primary_color', { length: 20 }).notNull().default('#1a1a2e'),
  secondaryColor: varchar('secondary_color', { length: 20 }).notNull().default('#16213e'),
  accentColor: varchar('accent_color', { length: 20 }).notNull().default('#e94560'),
  textOnPrimary: varchar('text_on_primary', { length: 20 }).notNull().default('#ffffff'),
  textOnSecondary: varchar('text_on_secondary', { length: 20 }).notNull().default('#ffffff'),
  logoUrl: text('logo_url'),
  fontFamily: varchar('font_family', { length: 100 }).notNull().default('Inter, sans-serif'),
  buttonRadius: varchar('button_radius', { length: 20 }).notNull().default('8px'),
  customCss: text('custom_css'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('branding_configs_venue_id_idx').on(table.venueId),
]);

// ─── Controllers ───────────────────────────────────────────────────────

export const controllers = pgTable('controllers', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueId: uuid('venue_id').notNull().references(() => venues.id),
  name: varchar('name', { length: 255 }).notNull(),
  platformSlug: varchar('platform_slug', { length: 50 }).notNull(),
  /** Encrypted JSONB — contains platform credentials. Never return to clients. */
  connectionConfig: text('connection_config').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  pollIntervalSeconds: integer('poll_interval_seconds').notNull().default(300),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('controllers_venue_id_idx').on(table.venueId),
]);

// ─── Endpoints ─────────────────────────────────────────────────────────

export const endpoints = pgTable('endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  controllerId: uuid('controller_id').notNull().references(() => controllers.id),
  venueId: uuid('venue_id').notNull().references(() => venues.id),
  platformEndpointId: varchar('platform_endpoint_id', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  deviceType: varchar('device_type', { length: 50 }).notNull(),
  currentState: jsonb('current_state'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  isAssigned: boolean('is_assigned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('endpoints_controller_id_idx').on(table.controllerId),
  index('endpoints_venue_id_idx').on(table.venueId),
]);

// ─── Groups ────────────────────────────────────────────────────────────

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueId: uuid('venue_id').notNull().references(() => venues.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: groupTypeEnum('type').notNull(),
  description: text('description'),
  /** Short URL-safe token for QR code access: /control/{access_token} */
  accessToken: varchar('access_token', { length: 32 }).notNull().unique(),
  qrCodeUrl: text('qr_code_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('groups_venue_id_idx').on(table.venueId),
  index('groups_access_token_idx').on(table.accessToken),
]);

// ─── Group Endpoints (Many-to-Many) ───────────────────────────────────

export const groupEndpoints = pgTable('group_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  endpointId: uuid('endpoint_id').notNull().references(() => endpoints.id),
  displayOrder: integer('display_order').notNull().default(0),
}, (table) => [
  index('group_endpoints_group_id_idx').on(table.groupId),
  index('group_endpoints_endpoint_id_idx').on(table.endpointId),
]);

// ─── Channels ──────────────────────────────────────────────────────────

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueId: uuid('venue_id').notNull().references(() => venues.id),
  platformChannelId: varchar('platform_channel_id', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  logoUrl: text('logo_url'),
  channelNumber: varchar('channel_number', { length: 20 }).notNull(),
  category: varchar('category', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('channels_venue_id_idx').on(table.venueId),
]);

// ─── Group Channel Lists (Optional Per-Group Channel Overrides) ──────

export const groupChannelLists = pgTable('group_channel_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id).unique(),
}, (table) => [
  index('group_channel_lists_group_id_idx').on(table.groupId),
]);

export const groupChannelItems = pgTable('group_channel_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupChannelListId: uuid('group_channel_list_id').notNull().references(() => groupChannelLists.id),
  channelId: uuid('channel_id').notNull().references(() => channels.id),
  displayOrder: integer('display_order').notNull().default(0),
}, (table) => [
  index('group_channel_items_list_id_idx').on(table.groupChannelListId),
  index('group_channel_items_channel_id_idx').on(table.channelId),
]);

// ─── Users ─────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  role: userRoleEnum('role').notNull().default('operator'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('users_tenant_id_idx').on(table.tenantId),
]);

// ─── Refresh Tokens ────────────────────────────────────────────────────

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('refresh_tokens_user_id_idx').on(table.userId),
]);

// ─── Audit Log ─────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_log_tenant_id_idx').on(table.tenantId),
  index('audit_log_entity_idx').on(table.entityType, table.entityId),
]);

// ─── Relations ─────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  venues: many(venues),
  users: many(users),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  tenant: one(tenants, { fields: [venues.tenantId], references: [tenants.id] }),
  controllers: many(controllers),
  endpoints: many(endpoints),
  groups: many(groups),
  channels: many(channels),
  brandingConfig: one(brandingConfigs, { fields: [venues.id], references: [brandingConfigs.venueId] }),
}));

export const brandingConfigsRelations = relations(brandingConfigs, ({ one }) => ({
  venue: one(venues, { fields: [brandingConfigs.venueId], references: [venues.id] }),
}));

export const controllersRelations = relations(controllers, ({ one, many }) => ({
  venue: one(venues, { fields: [controllers.venueId], references: [venues.id] }),
  endpoints: many(endpoints),
}));

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  controller: one(controllers, { fields: [endpoints.controllerId], references: [controllers.id] }),
  venue: one(venues, { fields: [endpoints.venueId], references: [venues.id] }),
  groupEndpoints: many(groupEndpoints),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  venue: one(venues, { fields: [groups.venueId], references: [venues.id] }),
  groupEndpoints: many(groupEndpoints),
  channelList: one(groupChannelLists, { fields: [groups.id], references: [groupChannelLists.groupId] }),
}));

export const groupEndpointsRelations = relations(groupEndpoints, ({ one }) => ({
  group: one(groups, { fields: [groupEndpoints.groupId], references: [groups.id] }),
  endpoint: one(endpoints, { fields: [groupEndpoints.endpointId], references: [endpoints.id] }),
}));

export const channelsRelations = relations(channels, ({ one }) => ({
  venue: one(venues, { fields: [channels.venueId], references: [venues.id] }),
}));

export const groupChannelListsRelations = relations(groupChannelLists, ({ one, many }) => ({
  group: one(groups, { fields: [groupChannelLists.groupId], references: [groups.id] }),
  items: many(groupChannelItems),
}));

export const groupChannelItemsRelations = relations(groupChannelItems, ({ one }) => ({
  list: one(groupChannelLists, { fields: [groupChannelItems.groupChannelListId], references: [groupChannelLists.id] }),
  channel: one(channels, { fields: [groupChannelItems.channelId], references: [channels.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
