/**
 * API request/response shapes for the SuiteCommand REST API.
 * Covers authentication, admin CRUD, and common response wrappers.
 * @module @suitecommand/types/api
 */

import type { GroupType, PlanTier, UserRole } from './tenant.js';

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
