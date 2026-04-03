/**
 * Tenant, venue, controller, endpoint, and group types.
 * These types define the core data model for the SuiteCommand platform.
 * @module @suitecommand/types/tenant
 */

/** Plan tiers available for tenants */
export type PlanTier = 'basic' | 'professional' | 'enterprise';

/** User roles within the system — 5-tier hierarchy */
export type UserRole = 'super_admin' | 'app_admin' | 'venue_super_admin' | 'venue_operator' | 'end_user';

/**
 * Controller categories — the type of system a controller manages.
 * Each platform belongs to exactly one category.
 *
 * Current categories:
 *   - iptv:     IPTV / TV control (VisionEdge, VITEC, TriplePlay)
 *   - audio:    Overhead / zone audio (Q-SYS, Omni)
 *   - video:    Video routing / switching (Crestron, Extron)
 *   - lighting: Lighting control (Lutron, ETC)
 *   - bms:      Building management / environmental (generic BMS, HVAC)
 */
export type ControllerCategory = 'iptv' | 'audio' | 'video' | 'lighting' | 'bms';

/** Group types representing physical spaces in a venue */
export type GroupType = 'suite' | 'room' | 'zone' | 'boh';

/** Access tiers for group access tokens — determines rotation behavior */
export type AccessTier = 'event' | 'seasonal' | 'permanent';

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
  /** IANA timezone string (e.g., "America/New_York") — used for token rotation ceiling */
  timezone: string;
  /** Per-venue custom domain for the control UI (e.g., "control.yankees.com") */
  customDomain?: string | null;
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
  /** System category this controller manages (iptv, audio, video, lighting, bms) */
  category: ControllerCategory;
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
  createdAt: string;
  deletedAt: string | null;
}

/** Event — a scheduled occurrence at a venue that drives token rotation */
export interface Event {
  id: string;
  venueId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  /** Token activates this many minutes before event start */
  preAccessMinutes: number;
  /** Token valid until this many minutes after event end */
  postAccessMinutes: number;
  createdAt: string;
  deletedAt: string | null;
}

/** Group access token — the QR code payload that gates control access */
export interface GroupAccessToken {
  id: string;
  groupId: string;
  /** URL-safe random string: /control/{token} */
  token: string;
  accessTier: AccessTier;
  /** NULL = valid immediately */
  validFrom: string | null;
  /** NULL = no scheduled expiry (seasonal/permanent) */
  validUntil: string | null;
  /** NULL for seasonal/permanent tokens */
  eventId: string | null;
  isActive: boolean;
  /** Set when this token is superseded by a new one */
  rotatedAt: string | null;
  createdAt: string;
}

/** SSO configuration for OIDC provider per tenant */
export interface SsoConfig {
  id: string;
  tenantId: string;
  providerName: string | null;
  /** OIDC discovery endpoint base URL */
  issuerUrl: string | null;
  clientId: string | null;
  /** Never returned to clients — encrypted at rest */
  clientSecretEnc?: string;
  isActive: boolean;
  createdAt: string;
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

/** User-to-venue assignment — controls which venues a user can access */
export interface UserVenueAssignment {
  id: string;
  userId: string;
  venueId: string;
  assignedAt: string;
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
