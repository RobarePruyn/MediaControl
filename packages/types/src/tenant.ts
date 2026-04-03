/**
 * Tenant, venue, controller, endpoint, and group types.
 * These types define the core data model for the SuiteCommand platform.
 * @module @suitecommand/types/tenant
 */

/** Plan tiers available for tenants */
export type PlanTier = 'basic' | 'professional' | 'enterprise';

/** User roles within the system */
export type UserRole = 'meta_admin' | 'site_admin' | 'operator';

/** Group types representing physical spaces in a venue */
export type GroupType = 'suite' | 'room' | 'zone' | 'boh';

/** Tenant — top-level organizational unit */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
  isActive: boolean;
  createdAt: string;
}

/** Venue — a physical location owned by a tenant */
export interface Venue {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  createdAt: string;
}

/** Branding configuration applied to the end-user control UI */
export interface BrandingConfig {
  id: string;
  venueId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textOnPrimary: string;
  textOnSecondary: string;
  logoUrl: string | null;
  fontFamily: string;
  buttonRadius: string;
  customCss: string | null;
}

/** Controller — a device platform instance (e.g., a VisionEdge server) */
export interface Controller {
  id: string;
  venueId: string;
  name: string;
  platformSlug: string;
  /** Connection config is encrypted at rest; never returned to clients */
  connectionConfig?: unknown;
  isActive: boolean;
  lastPolledAt: string | null;
  pollIntervalSeconds: number;
  createdAt: string;
}

/** Endpoint — a single controllable device discovered from a controller */
export interface Endpoint {
  id: string;
  controllerId: string;
  venueId: string;
  platformEndpointId: string;
  displayName: string;
  deviceType: string;
  currentState: EndpointState | null;
  lastSeenAt: string | null;
  isAssigned: boolean;
  createdAt: string;
}

/** Current state of an endpoint as stored in the database */
export interface EndpointState {
  isPoweredOn: boolean | null;
  currentInput: string | null;
  currentChannelNumber: string | null;
  volumeLevel: number | null;
  isMuted: boolean | null;
}

/** Group — a logical grouping of endpoints (suite, room, zone, or BOH area) */
export interface Group {
  id: string;
  venueId: string;
  name: string;
  type: GroupType;
  description: string | null;
  accessToken: string;
  qrCodeUrl: string | null;
  createdAt: string;
  deletedAt: string | null;
}

/** Association between a group and an endpoint with display ordering */
export interface GroupEndpoint {
  id: string;
  groupId: string;
  endpointId: string;
  displayOrder: number;
}

/** Channel — a TV channel available at a venue */
export interface Channel {
  id: string;
  venueId: string;
  platformChannelId: string;
  displayName: string;
  logoUrl: string | null;
  channelNumber: string;
  category: string | null;
  isActive: boolean;
  displayOrder: number;
}

/** User — an authenticated admin or operator */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  /** Null for local auth, or the identity provider slug for SSO users */
  authProvider: string | null;
  /** External subject/nameID from the IdP for SSO users */
  externalId: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Audit log entry */
export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  createdAt: string;
}

// ─── Identity Providers ────────────────────────────────────────────────

/** Supported SSO/identity provider protocols */
export type IdpProtocol = 'oidc' | 'saml' | 'ldap';

/** Identity provider configuration for a tenant */
export interface IdentityProvider {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  protocol: IdpProtocol;
  /** Config is encrypted at rest; secrets redacted when returned to clients */
  config?: unknown;
  attributeMapping: Record<string, string> | null;
  isActive: boolean;
  createdAt: string;
}

// ─── TLS Certificates ─────────────────────────────────────────────────

/** TLS certificate metadata stored for audit */
export interface TlsCertificate {
  id: string;
  tenantId: string;
  subject: string;
  sans: string[];
  issuer: string;
  expiresAt: string;
  uploadedBy: string | null;
  uploadedAt: string;
  isActive: boolean;
}

// ─── Triggers ──────────────────────────────────────────────────────────

/** Trigger action types */
export type TriggerActionType = 'command' | 'delay' | 'conditional';

/** Trigger execution states */
export type TriggerExecutionState = 'running' | 'completed' | 'failed' | 'cancelled';

/** Trigger target scope */
export type TriggerTargetType = 'group' | 'venue';

/** A named automation trigger scoped to a venue */
export interface Trigger {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single step within a trigger */
export interface TriggerAction {
  id: string;
  triggerId: string;
  actionOrder: number;
  actionType: TriggerActionType;
  config: TriggerCommandConfig | TriggerDelayConfig | TriggerConditionalConfig;
}

/** Config for a 'command' action */
export interface TriggerCommandConfig {
  commandType: string;
  payload: Record<string, unknown>;
}

/** Config for a 'delay' action */
export interface TriggerDelayConfig {
  delayMs: number;
}

/** Config for a 'conditional' action */
export interface TriggerConditionalConfig {
  check: string;
  expect: unknown;
  onFail: 'skip' | 'abort';
}

/** Target scope for a trigger */
export interface TriggerTarget {
  id: string;
  triggerId: string;
  targetType: TriggerTargetType;
  targetId: string;
}

/** Record of a trigger execution */
export interface TriggerExecution {
  id: string;
  triggerId: string;
  startedBy: string | null;
  state: TriggerExecutionState;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  executionLog: unknown;
}
