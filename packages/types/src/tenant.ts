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
