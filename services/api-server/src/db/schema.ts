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
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'app_admin', 'venue_super_admin', 'venue_operator', 'end_user']);
export const groupTypeEnum = pgEnum('group_type', ['suite', 'room', 'zone', 'boh']);
export const accessTierEnum = pgEnum('access_tier', ['event', 'seasonal', 'permanent']);
export const idpProtocolEnum = pgEnum('idp_protocol', ['oidc', 'saml', 'ldap']);
export const triggerActionTypeEnum = pgEnum('trigger_action_type', ['command', 'delay', 'conditional']);
export const triggerExecutionStateEnum = pgEnum('trigger_execution_state', ['running', 'completed', 'failed', 'cancelled']);

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
  /** IANA timezone string — required for daily token rotation ceiling calculation */
  timezone: varchar('timezone', { length: 64 }).notNull().default('America/New_York'),
  /** Per-venue custom domain for the control UI (e.g., "control.yankees.com") */
  customDomain: varchar('custom_domain', { length: 255 }),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('groups_venue_id_idx').on(table.venueId),
]);

// ─── Events ────────────────────────────────────────────────────────────

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueId: uuid('venue_id').notNull().references(() => venues.id),
  name: varchar('name', { length: 255 }).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  /** Token activates this many minutes before event start */
  preAccessMinutes: integer('pre_access_minutes').notNull().default(120),
  /** Token valid until this many minutes after event end */
  postAccessMinutes: integer('post_access_minutes').notNull().default(60),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('events_venue_id_idx').on(table.venueId),
  index('events_starts_at_idx').on(table.startsAt),
]);

// ─── Group Access Tokens ───────────────────────────────────────────────

export const groupAccessTokens = pgTable('group_access_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  /** URL-safe random string — the QR code payload: /control/{token} */
  token: varchar('token', { length: 24 }).notNull().unique(),
  accessTier: accessTierEnum('access_tier').notNull(),
  /** NULL = valid immediately */
  validFrom: timestamp('valid_from', { withTimezone: true }),
  /** NULL = no scheduled expiry (seasonal/permanent) */
  validUntil: timestamp('valid_until', { withTimezone: true }),
  /** NULL for seasonal/permanent tokens */
  eventId: uuid('event_id').references(() => events.id),
  isActive: boolean('is_active').notNull().default(true),
  /** Set when this token is superseded by a new one */
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('group_access_tokens_group_id_idx').on(table.groupId),
  index('group_access_tokens_token_idx').on(table.token),
  index('group_access_tokens_event_id_idx').on(table.eventId),
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
  /** Nullable for SSO-only users who never set a local password */
  hashedPassword: text('hashed_password'),
  role: userRoleEnum('role').notNull().default('venue_operator'),
  /** Null for local auth, or the identity_provider slug for SSO users */
  authProvider: varchar('auth_provider', { length: 100 }),
  /** External subject/nameID from the IdP for SSO users */
  externalId: varchar('external_id', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('users_tenant_id_idx').on(table.tenantId),
]);

// ─── User Venues (Many-to-Many: User ↔ Venue Access) ──────────────────

export const userVenues = pgTable('user_venues', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  venueId: uuid('venue_id').notNull().references(() => venues.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('user_venues_user_id_idx').on(table.userId),
  index('user_venues_venue_id_idx').on(table.venueId),
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

// ─── Identity Providers ────────────────────────────────────────────────

export const identityProviders = pgTable('identity_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  protocol: idpProtocolEnum('protocol').notNull(),
  /** Encrypted JSONB — clientId, clientSecret, metadata URL, LDAP bind DN, etc. */
  config: text('config').notNull(),
  /** Maps IdP claims/attributes to SuiteCommand user fields */
  attributeMapping: jsonb('attribute_mapping'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('identity_providers_tenant_id_idx').on(table.tenantId),
]);

// ─── SSO Configs (OIDC Provider per Tenant) ───────────────────────────

export const ssoConfigs = pgTable('sso_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  providerName: varchar('provider_name', { length: 64 }),
  /** OIDC discovery endpoint base URL */
  issuerUrl: varchar('issuer_url', { length: 512 }),
  clientId: varchar('client_id', { length: 255 }),
  /** Encrypted with CREDENTIAL_ENCRYPTION_KEY */
  clientSecretEnc: text('client_secret_enc'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sso_configs_tenant_id_idx').on(table.tenantId),
]);

// ─── TLS Certificates ─────────────────────────────────────────────────

export const tlsCertificates = pgTable('tls_certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  subject: varchar('subject', { length: 500 }).notNull(),
  sans: jsonb('sans').notNull(),
  issuer: varchar('issuer', { length: 500 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
  /** Pending CSR data if cert was generated via CSR flow */
  pendingCsr: text('pending_csr'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('tls_certificates_tenant_id_idx').on(table.tenantId),
]);

// ─── Triggers ──────────────────────────────────────────────────────────

export const triggers = pgTable('triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueId: uuid('venue_id').notNull().references(() => venues.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('triggers_venue_id_idx').on(table.venueId),
]);

export const triggerActions = pgTable('trigger_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  triggerId: uuid('trigger_id').notNull().references(() => triggers.id),
  actionOrder: integer('action_order').notNull(),
  actionType: triggerActionTypeEnum('action_type').notNull(),
  /** Config varies by action type: command payload, delay_ms, conditional expression */
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('trigger_actions_trigger_id_idx').on(table.triggerId),
]);

export const triggerTargets = pgTable('trigger_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  triggerId: uuid('trigger_id').notNull().references(() => triggers.id),
  targetType: varchar('target_type', { length: 20 }).notNull(), // 'group' | 'venue'
  targetId: uuid('target_id').notNull(),
}, (table) => [
  index('trigger_targets_trigger_id_idx').on(table.triggerId),
]);

export const triggerExecutions = pgTable('trigger_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  triggerId: uuid('trigger_id').notNull().references(() => triggers.id),
  startedBy: uuid('started_by').references(() => users.id),
  state: triggerExecutionStateEnum('state').notNull().default('running'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  /** Per-action results log */
  executionLog: jsonb('execution_log'),
}, (table) => [
  index('trigger_executions_trigger_id_idx').on(table.triggerId),
]);

// ─── Relations ─────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  venues: many(venues),
  users: many(users),
  identityProviders: many(identityProviders),
  ssoConfigs: many(ssoConfigs),
  tlsCertificates: many(tlsCertificates),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  tenant: one(tenants, { fields: [venues.tenantId], references: [tenants.id] }),
  controllers: many(controllers),
  endpoints: many(endpoints),
  groups: many(groups),
  events: many(events),
  channels: many(channels),
  triggers: many(triggers),
  brandingConfig: one(brandingConfigs, { fields: [venues.id], references: [brandingConfigs.venueId] }),
  userVenues: many(userVenues),
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
  accessTokens: many(groupAccessTokens),
  channelList: one(groupChannelLists, { fields: [groups.id], references: [groupChannelLists.groupId] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  venue: one(venues, { fields: [events.venueId], references: [venues.id] }),
  accessTokens: many(groupAccessTokens),
}));

export const groupAccessTokensRelations = relations(groupAccessTokens, ({ one }) => ({
  group: one(groups, { fields: [groupAccessTokens.groupId], references: [groups.id] }),
  event: one(events, { fields: [groupAccessTokens.eventId], references: [events.id] }),
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
  userVenues: many(userVenues),
}));

export const userVenuesRelations = relations(userVenues, ({ one }) => ({
  user: one(users, { fields: [userVenues.userId], references: [users.id] }),
  venue: one(venues, { fields: [userVenues.venueId], references: [venues.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const identityProvidersRelations = relations(identityProviders, ({ one }) => ({
  tenant: one(tenants, { fields: [identityProviders.tenantId], references: [tenants.id] }),
}));

export const ssoConfigsRelations = relations(ssoConfigs, ({ one }) => ({
  tenant: one(tenants, { fields: [ssoConfigs.tenantId], references: [tenants.id] }),
}));

export const triggersRelations = relations(triggers, ({ one, many }) => ({
  venue: one(venues, { fields: [triggers.venueId], references: [venues.id] }),
  createdByUser: one(users, { fields: [triggers.createdBy], references: [users.id] }),
  actions: many(triggerActions),
  targets: many(triggerTargets),
  executions: many(triggerExecutions),
}));

export const triggerActionsRelations = relations(triggerActions, ({ one }) => ({
  trigger: one(triggers, { fields: [triggerActions.triggerId], references: [triggers.id] }),
}));

export const triggerTargetsRelations = relations(triggerTargets, ({ one }) => ({
  trigger: one(triggers, { fields: [triggerTargets.triggerId], references: [triggers.id] }),
}));

export const triggerExecutionsRelations = relations(triggerExecutions, ({ one }) => ({
  trigger: one(triggers, { fields: [triggerExecutions.triggerId], references: [triggers.id] }),
  startedByUser: one(users, { fields: [triggerExecutions.startedBy], references: [users.id] }),
}));
