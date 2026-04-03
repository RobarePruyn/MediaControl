/**
 * API request/response shapes for the SuiteCommand REST API.
 * Covers authentication, admin CRUD, and common response wrappers.
 * @module @suitecommand/types/api
 */

import type { AccessTier, ControllerCategory, GroupType, IdpProtocol, PlanTier, TriggerActionType, TriggerTargetType, UserRole } from './tenant.js';

// ─── Common Response Wrappers ──────────────────────────────────────────

/** Standard API success response wrapper */
export interface ApiResponse<T> {
  success: true;
  data: T;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ─── Authentication ────────────────────────────────────────────────────

/** Login request body */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Login response body */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string;
    /** Venue IDs this user has access to (not in JWT — loaded per-request on server) */
    venueIds: string[];
  };
}

/** Refresh token request body */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Refresh token response body */
export interface RefreshTokenResponse {
  accessToken: string;
}

// ─── Admin: Controllers ────────────────────────────────────────────────

/** Create controller request */
export interface CreateControllerRequest {
  name: string;
  category: ControllerCategory;
  platformSlug: string;
  connectionConfig: Record<string, unknown>;
  venueId: string;
  pollIntervalSeconds?: number;
}

/** Update controller request */
export interface UpdateControllerRequest {
  name?: string;
  connectionConfig?: Record<string, unknown>;
  isActive?: boolean;
  pollIntervalSeconds?: number;
}

// ─── Admin: Endpoints ──────────────────────────────────────────────────

/** Update endpoint request */
export interface UpdateEndpointRequest {
  displayName?: string;
  groupId?: string | null;
}

/** Bulk assign endpoints to a group */
export interface BulkAssignEndpointsRequest {
  endpointIds: string[];
  groupId: string;
}

// ─── Admin: Groups ─────────────────────────────────────────────────────

/** Create group request */
export interface CreateGroupRequest {
  name: string;
  type: GroupType;
  venueId: string;
  description?: string;
}

/** Update group request */
export interface UpdateGroupRequest {
  name?: string;
  type?: GroupType;
  description?: string;
}

/** Add endpoints to group request */
export interface AddEndpointsToGroupRequest {
  endpointIds: string[];
}

// ─── Admin: Channels ───────────────────────────────────────────────────

/** Create channel request */
export interface CreateChannelRequest {
  venueId: string;
  platformChannelId: string;
  displayName: string;
  channelNumber: string;
  logoUrl?: string;
  category?: string;
}

/** Update channel request */
export interface UpdateChannelRequest {
  displayName?: string;
  logoUrl?: string;
  category?: string;
  isActive?: boolean;
}

/** Bulk reorder channels request */
export interface ReorderChannelsRequest {
  channelOrders: Array<{
    id: string;
    displayOrder: number;
  }>;
}

// ─── Admin: Branding ───────────────────────────────────────────────────

/** Update branding request */
export interface UpdateBrandingRequest {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  textOnPrimary?: string;
  textOnSecondary?: string;
  fontFamily?: string;
  buttonRadius?: string;
  customCss?: string | null;
}

// ─── Admin: Tenants ────────────────────────────────────────────────────

/** Create tenant request (meta-admin only) */
export interface CreateTenantRequest {
  name: string;
  slug: string;
  planTier?: PlanTier;
}

/** Create venue request */
export interface CreateVenueRequest {
  name: string;
  slug: string;
  tenantId: string;
  timezone?: string;
}

/** Update venue request */
export interface UpdateVenueRequest {
  name?: string;
  slug?: string;
  timezone?: string;
  customDomain?: string | null;
}

// ─── Admin: Events ─────────────────────────────────────────────────────

/** Create event request */
export interface CreateEventRequest {
  venueId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  preAccessMinutes?: number;
  postAccessMinutes?: number;
}

/** Update event request */
export interface UpdateEventRequest {
  name?: string;
  startsAt?: string;
  endsAt?: string;
  preAccessMinutes?: number;
  postAccessMinutes?: number;
}

// ─── Admin: Group Access Tokens ────────────────────────────────────────

/** Create group access token request */
export interface CreateGroupAccessTokenRequest {
  groupId: string;
  accessTier: AccessTier;
  eventId?: string;
  validFrom?: string;
  validUntil?: string;
}

/** Rotate (invalidate current, create new) group access token */
export interface RotateGroupAccessTokenRequest {
  groupId: string;
  accessTier: AccessTier;
  eventId?: string;
}

// ─── Admin: SSO Config ─────────────────────────────────────────────────

/** Create/update SSO config request */
export interface UpsertSsoConfigRequest {
  providerName: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
}

// ─── Bridge Agent Internal API ─────────────────────────────────────────

/** Bridge command request body */
export interface BridgeCommandRequest {
  platformEndpointId: string;
  commandType: string;
  payload: Record<string, unknown>;
  connectionConfig: Record<string, unknown>;
  platformSlug: string;
}

// ─── Admin: Identity Providers ─────────────────────────────────────────

/** Create identity provider request */
export interface CreateIdentityProviderRequest {
  name: string;
  slug: string;
  protocol: IdpProtocol;
  config: Record<string, unknown>;
  attributeMapping?: Record<string, string>;
}

/** Update identity provider request */
export interface UpdateIdentityProviderRequest {
  name?: string;
  config?: Record<string, unknown>;
  attributeMapping?: Record<string, string>;
  isActive?: boolean;
}

// ─── Admin: TLS Certificates ──────────────────────────────────────────

/** Generate CSR request */
export interface GenerateCsrRequest {
  commonName: string;
  sans: string[];
  organization?: string;
  country?: string;
}

/** TLS certificate status response */
export interface TlsCertificateStatus {
  subject: string;
  sans: string[];
  issuer: string;
  expiresAt: string;
  daysUntilExpiry: number;
  isActive: boolean;
  uploadedAt: string;
}

// ─── Admin: Triggers ──────────────────────────────────────────────────

/** Create trigger request */
export interface CreateTriggerRequest {
  name: string;
  venueId: string;
  description?: string;
}

/** Update trigger request */
export interface UpdateTriggerRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

/** Set trigger actions request */
export interface SetTriggerActionsRequest {
  actions: Array<{
    actionOrder: number;
    actionType: TriggerActionType;
    config: Record<string, unknown>;
  }>;
}

/** Set trigger targets request */
export interface SetTriggerTargetsRequest {
  targets: Array<{
    targetType: TriggerTargetType;
    targetId: string;
  }>;
}

/** Trigger execution response */
export interface TriggerExecutionResponse {
  executionId: string;
  state: string;
  startedAt: string;
}

// ─── Admin: User Management ──────────────────────────────────────────

/** Create user request */
export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  venueIds?: string[];
}

/** Update user request */
export interface UpdateUserRequest {
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

/** Assign venues to user request */
export interface AssignVenuesRequest {
  venueIds: string[];
}

/** User with venue assignments (for admin list view) */
export interface UserWithVenues {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  authProvider: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  venueIds: string[];
}

// ─── Control: Domain Resolution ──────────────────────────────────────

/** Resolve venue by custom domain */
export interface DomainResolutionResponse {
  venueId: string;
  venueName: string;
  venueSlug: string;
  tenantId: string;
}
