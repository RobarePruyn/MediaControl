# SuiteCommand — Claude Code Project Specification
## Version 1.0 | Phase 1: On-Premises Deployment

---

## 1. PROJECT OVERVIEW

**SuiteCommand** is a BYOD (Bring Your Own Device) venue control platform for professional sports and entertainment suites and back-of-house spaces. Guests and staff access a branded web interface — via QR code or direct URL — to control in-suite technology: IPTV (TV power, input, volume, channel), and in future phases, overhead audio (Q-SYS/Omni), lighting, and environmental systems.

**Phase 1 Scope:**
- On-premises deployment (Docker Compose on a single VM or bare-metal host)
- IPTV control via **WiPro VisionEdge** REST API
- Admin interface: controller management, endpoint discovery, group/room/zone assignment
- End-user web interface: brandable per venue/team, QR-code delivered
- QR code generation: hostable (embed in IPTV as web content) and exportable (print)
- Architecture must cleanly support a future split into on-prem agent + cloud application

---

## 2. ARCHITECTURE DECISIONS

### 2.1 Guiding Principles

1. **Adapter-first device support** — All device platform integrations (VisionEdge and future systems) are implemented behind a common interface. No platform-specific logic leaks into business logic.
2. **Tenant-ready from day one** — Data models include tenant/venue scoping even in Phase 1. Single-tenant in Phase 1 means a single "default" tenant; multi-tenant in Phase 2 is an operational configuration change, not a refactor.
3. **Clean architectural seam for cloud migration** — The on-prem "bridge agent" (which holds credentials and network access to device APIs) is designed as a discrete service that can be containerized and remain on-prem when the rest of the application moves to cloud.
4. **Web-first end-user UI** — No native app dependency. The end-user interface is a responsive, embeddable web application. Teams can iframe or web-view it inside their official app.

### 2.2 Service Architecture (Phase 1 — All On-Prem)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Docker Compose Host (On-Prem VM / Container Host)                  │
│                                                                      │
│  ┌───────────────┐   ┌───────────────┐   ┌────────────────────────┐│
│  │  Nginx        │   │  Admin UI     │   │  End-User Control UI   ││
│  │  (Reverse     │──▶│  (React/Vite) │   │  (React/Vite, thin,   ││
│  │   Proxy +     │   │  Port 3001    │   │   embeddable)          ││
│  │   Static      │──▶│               │   │  Port 3002             ││
│  │   Assets)     │──▶│               │   │                        ││
│  │  Port 80/443  │   └───────┬───────┘   └──────────┬─────────────┘│
│  └───────┬───────┘           │                      │              │
│          │              REST/WS API                  │              │
│          │           ┌───────▼──────────────────────▼──────────┐  │
│          │           │  API Server (Node.js / Express + WS)    │  │
│          └──────────▶│  Port 4000                               │  │
│                      │  - Auth (JWT)                            │  │
│                      │  - Admin routes                          │  │
│                      │  - Control routes                        │  │
│                      │  - QR code service                       │  │
│                      │  - Platform adapter registry             │  │
│                      └───────┬──────────────────────────────────┘  │
│                              │                                      │
│              ┌───────────────┼──────────────────┐                  │
│              │               │                  │                  │
│    ┌─────────▼──────┐  ┌────▼──────┐  ┌────────▼──────────────┐   │
│    │  PostgreSQL     │  │  Redis    │  │  Bridge Agent Service  │   │
│    │  (Persistent   │  │  (State   │  │  (On-Prem Component)   │   │
│    │   Config +     │  │   Cache + │  │  - WiPro VisionEdge    │   │
│    │   Audit Log)   │  │   Pub/Sub │  │    API client          │   │
│    │  Port 5432     │  │   for WS) │  │  - Polling / Discovery │   │
│    └────────────────┘  │  Port 6379│  │  - Future adapters     │   │
│                        └───────────┘  │  Port 4001 (internal)  │   │
│                                       └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                          LAN / VLAN boundary
                                  │
                    ┌─────────────▼────────────┐
                    │  WiPro VisionEdge Server  │
                    │  (Existing infrastructure)│
                    └──────────────────────────┘
```

### 2.3 Phase 2 Cloud Migration Path (Design Intent Only — Not Built in Phase 1)

In Phase 2, the Bridge Agent stays on-prem. Everything else (API Server, Admin UI, End-User UI, PostgreSQL, Redis) migrates to cloud. The Bridge Agent authenticates to the cloud API via long-lived token and acts as a local proxy for device commands. This seam is why the Bridge Agent is a discrete service even in Phase 1.

```
Cloud:  [Admin UI] [End-User UI] [API Server] [PostgreSQL] [Redis]
           │                           │
           └─────────── HTTPS ─────────┘
                                       │
On-Prem:                    [Bridge Agent] ──── [VisionEdge / Device APIs]
```

---

## 3. TECH STACK

| Layer | Technology | Rationale |
|---|---|---|
| **Runtime** | Node.js 20 LTS | Strong async/WS support; consistent across services |
| **API Framework** | Express 5 + `express-ws` | Mature, minimal, WS support without full framework overhead |
| **Language** | TypeScript (strict mode) | Required for maintainability across API, bridge, and shared types |
| **Shared Types** | `packages/types` (monorepo package) | Single source of truth for DTOs, API contracts, enums |
| **Admin UI** | React 18 + Vite + TanStack Query | Fast dev cycle; TanStack handles server state well for polling-heavy admin |
| **End-User UI** | React 18 + Vite | Lightweight; will be iframe-embeddable |
| **UI Component Library** | shadcn/ui (Admin) | Accessible, unstyled-first, easy to extend |
| **End-User Styling** | CSS custom properties (theming) | Runtime-swappable venue branding without rebuild |
| **Database** | PostgreSQL 16 | Relational, cloud-portable (RDS, CloudSQL, Supabase) |
| **ORM** | Drizzle ORM | TypeScript-native, lightweight, good migration story |
| **Cache / Pub-Sub** | Redis 7 | Device state cache + WebSocket message bus |
| **Auth** | JWT (access + refresh tokens) + OIDC/SAML SSO | Stateless JWTs; SSO via Passport.js strategies |
| **SSO** | `passport-openidconnect` + `passport-saml` | Okta (OIDC) primary; SAML for Entra ID / generic IdPs |
| **QR Codes** | `qrcode` npm package | No external dependency; generates PNG/SVG |
| **Container** | Docker Compose v2 | Phase 1 deployment target |
| **Reverse Proxy** | Nginx (in compose stack) | TLS termination, static asset serving, service routing |
| **Package Manager** | pnpm workspaces | Monorepo with shared packages |

---

## 4. MONOREPO STRUCTURE

```
suitecommand/
├── CLAUDE.md                          # This file — project instructions for Claude Code
├── docker-compose.yml                 # Phase 1 full-stack compose file
├── docker-compose.override.yml        # Local dev overrides (hot reload, debug ports)
├── nginx/
│   └── nginx.conf                     # Reverse proxy configuration
├── packages/
│   └── types/                         # Shared TypeScript types (DTOs, enums, contracts)
│       ├── package.json
│       └── src/
│           ├── index.ts
│           ├── api.ts                  # API request/response shapes
│           ├── devices.ts              # Device platform types and adapter interface
│           ├── control.ts              # Control command types (power, input, volume, channel)
│           └── tenant.ts              # Tenant, venue, controller, endpoint types
├── services/
│   ├── api-server/                    # Core REST + WebSocket API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts               # Entry point, server bootstrap
│   │       ├── config.ts              # Environment config (typed, validated with zod)
│   │       ├── db/
│   │       │   ├── client.ts          # Drizzle client instance
│   │       │   ├── schema.ts          # Full Drizzle schema definition
│   │       │   └── migrations/        # Drizzle migration files
│   │       ├── middleware/
│   │       │   ├── auth.ts            # JWT verification middleware
│   │       │   ├── tenantScope.ts     # Scopes DB queries to requesting tenant
│   │       │   └── errorHandler.ts    # Centralized error handler
│   │       ├── routes/
│   │       │   ├── auth.ts            # Login, refresh token, logout, SSO initiate/callback
│   │       │   ├── admin/
│   │       │   │   ├── tenants.ts     # Tenant CRUD (meta-admin only)
│   │       │   │   ├── venues.ts      # Venue CRUD
│   │       │   │   ├── controllers.ts # Controller (device platform instance) CRUD
│   │       │   │   ├── endpoints.ts   # Endpoint CRUD + manual assignment
│   │       │   │   ├── groups.ts      # Group CRUD (rooms/zones/suites)
│   │       │   │   ├── channels.ts    # Channel list management
│   │       │   │   ├── branding.ts    # Venue branding config
│   │       │   │   ├── discovery.ts   # Trigger/poll discovery from bridge agent
│   │       │   │   ├── tls.ts        # TLS certificate management
│   │       │   │   ├── identityProviders.ts  # SSO/IdP configuration
│   │       │   │   └── triggers.ts   # Trigger CRUD and execution
│   │       │   ├── control/
│   │       │   │   └── index.ts       # End-user control commands (power, input, vol, ch)
│   │       │   └── qr/
│   │       │       └── index.ts       # QR code generation and file hosting
│   │       ├── websocket/
│   │       │   └── index.ts           # WebSocket hub (device state push to clients)
│   │       └── services/
│   │           ├── bridgeClient.ts    # HTTP client to communicate with bridge agent
│   │           ├── qrService.ts       # QR code generation logic
│   │           └── stateCache.ts      # Redis-backed device state cache
│   │
│   └── bridge-agent/                  # On-prem device API bridge (stays local in cloud phase)
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── src/
│           ├── index.ts               # Entry point
│           ├── config.ts              # Environment config
│           ├── adapters/
│           │   ├── AdapterInterface.ts # Abstract base — ALL device adapters implement this
│           │   ├── registry.ts         # Maps platform slug → adapter class
│           │   └── visionedge/
│           │       ├── VisionEdgeAdapter.ts  # WiPro VisionEdge implementation
│           │       ├── visionEdgeClient.ts   # Raw HTTP client for VisionEdge API
│           │       └── visionEdgeTypes.ts    # VisionEdge-specific API types
│           ├── discovery/
│           │   └── discoveryWorker.ts  # Periodic polling of device platforms for endpoints
│           └── routes/
│               └── index.ts            # Internal API routes (called by api-server only)
│
├── apps/
│   ├── admin-ui/                      # Admin web application
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── api/                   # TanStack Query hooks wrapping API calls
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   ├── controllers/       # Controller management views
│   │       │   ├── endpoints/         # Endpoint list, assignment, bulk ops
│   │       │   ├── groups/            # Group (suite/room/zone) management
│   │       │   ├── channels/          # Channel list management
│   │       │   ├── branding/          # Venue branding config UI
│   │       │   └── qr/               # QR code preview and export
│   │       ├── pages/
│   │       └── types/                 # UI-local types (extend from packages/types)
│   │
│   └── control-ui/                   # End-user control web application
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── src/
│           ├── main.tsx
│           ├── App.tsx               # Loads branding config on mount, applies CSS vars
│           ├── api/                  # Control command calls + WebSocket connection
│           ├── components/
│           │   ├── TVControl.tsx     # Power, input, volume, channel controls
│           │   ├── ChannelGrid.tsx   # Channel picker with logos
│           │   ├── VolumeSlider.tsx
│           │   └── BrandingProvider.tsx  # Injects CSS custom properties from branding config
│           └── pages/
│               └── ControlPage.tsx  # Route: /control/:groupToken
│
└── scripts/
    ├── seed-dev.ts                    # Seeds a default tenant + admin user for local dev
    └── generate-qr.ts                # Standalone QR generation utility (optional CLI)
```

---

## 5. DATABASE SCHEMA (Drizzle — PostgreSQL)

Define all tables in `services/api-server/src/db/schema.ts`. All tables use UUID primary keys. All foreign keys are indexed. Soft-delete (deleted_at timestamp) preferred over hard-delete for audit trail.

```typescript
// Key tables — implement these in full with Drizzle pgTable syntax

tenants              // id, name, slug, plan_tier, is_active, created_at
  └── venues         // id, tenant_id, name, slug, logo_url, primary_color, secondary_color, accent_color
        └── branding_configs // id, venue_id, primary_color, secondary_color, logo_url, font_family, custom_css

controllers          // id, venue_id, name, platform_slug ('visionedge' etc), connection_config (jsonb, encrypted),
                     //   is_active, last_polled_at, poll_interval_seconds, created_at

endpoints            // id, controller_id, venue_id, platform_endpoint_id (native ID from device system),
                     //   display_name, device_type, current_state (jsonb), last_seen_at, is_assigned, created_at

groups               // id, venue_id, name, type (ENUM: suite | room | zone | boh), description,
                     //   access_token (short unique token for QR URL), qr_code_url, created_at

group_endpoints      // id, group_id, endpoint_id, display_order  (many-to-many: one group, many endpoints)

channels             // id, venue_id, platform_channel_id, display_name, logo_url, channel_number,
                     //   category, is_active, display_order

group_channel_lists  // id, group_id — optional override: restrict channel list per group
group_channel_items  // group_channel_list_id, channel_id, display_order

users                // id, tenant_id, email, hashed_password, role (ENUM: meta_admin | site_admin | operator),
                     //   is_active, created_at, last_login_at

refresh_tokens       // id, user_id, token_hash, expires_at, revoked_at

audit_log            // id, tenant_id, user_id, action, entity_type, entity_id, payload (jsonb), created_at
```

**Important schema notes for Claude Code:**
- `connection_config` on `controllers` stores platform credentials (API URL, auth token, etc.) as JSONB. This field must be encrypted at rest using AES-256 via a server-side encryption utility before storage and decrypted on read. Do not store credentials in plaintext.
- `current_state` on `endpoints` stores last-known device state (power on/off, current input, current channel, volume level) as JSONB. This is the cache of record; Redis mirrors it for fast reads.
- `access_token` on `groups` is a short, URL-safe random string (12–16 chars) used as the QR code URL path: `/control/{access_token}`. It is not a security credential — the control page is intentionally unauthenticated for guests.

---

## 6. THE ADAPTER INTERFACE

This is the most critical abstraction in the codebase. **Every device platform adapter must implement this interface exactly.** No platform-specific types should appear outside the `adapters/` directory.

```typescript
// packages/types/src/devices.ts

/** Canonical command types supported across all platforms */
export type ControlCommandType = 'POWER' | 'INPUT' | 'VOLUME' | 'CHANNEL' | 'MUTE';

/** A single control command sent from the API server to the bridge agent */
export interface ControlCommand {
  commandType: ControlCommandType;
  /** Platform-native endpoint ID (from EndpointRecord.platform_endpoint_id) */
  platformEndpointId: string;
  payload: PowerPayload | InputPayload | VolumePayload | ChannelPayload | MutePayload;
}

export interface PowerPayload { state: 'on' | 'off' | 'toggle'; }
export interface InputPayload { input: string; }  // Platform-native input name
export interface VolumePayload { level: number; }  // 0–100
export interface ChannelPayload { channelNumber: string; }
export interface MutePayload { muted: boolean; }

/** Normalized state returned by all adapters — platform details are stripped */
export interface NormalizedEndpointState {
  platformEndpointId: string;
  displayName: string;
  isPoweredOn: boolean | null;      // null = unknown
  currentInput: string | null;
  currentChannelNumber: string | null;
  volumeLevel: number | null;       // 0–100 or null if unsupported
  isMuted: boolean | null;
  rawPlatformData?: unknown;        // Preserved for debugging; not exposed to end users
}

/** Discovered endpoint metadata returned during polling */
export interface DiscoveredEndpoint {
  platformEndpointId: string;
  displayName: string;
  deviceType: string;               // e.g. 'tv', 'display', 'projector'
  capabilities: ControlCommandType[];
  availableInputs: string[];
}

/** Connection config shape — concrete per-platform, but bridge stores as unknown */
export interface PlatformConnectionConfig {
  platform: string;  // Must match registry slug
  [key: string]: unknown;
}

/**
 * The contract every platform adapter must fulfill.
 * Implement this class for each new platform (VisionEdge, SITO, etc.)
 */
export interface IPlatformAdapter {
  /** Human-readable platform name */
  readonly platformName: string;
  /** Unique slug used in DB and config (e.g. 'visionedge') */
  readonly platformSlug: string;

  /** Test connectivity with stored credentials. Throws on failure. */
  testConnection(): Promise<void>;

  /** Fetch all discoverable endpoints from the platform */
  discoverEndpoints(): Promise<DiscoveredEndpoint[]>;

  /** Fetch and normalize current state for a single endpoint */
  getEndpointState(platformEndpointId: string): Promise<NormalizedEndpointState>;

  /** Send a control command. Returns updated state after command. */
  sendCommand(command: ControlCommand): Promise<NormalizedEndpointState>;

  /** Optional: Fetch platform-native channel list */
  discoverChannels?(): Promise<Array<{ channelNumber: string; displayName: string }>>;
}
```

---

## 7. VISIONEDGE ADAPTER — IMPLEMENTATION GUIDANCE

Implement `VisionEdgeAdapter` as a concrete class implementing `IPlatformAdapter`.

**Connection config fields for VisionEdge:**
```typescript
interface VisionEdgeConnectionConfig extends PlatformConnectionConfig {
  platform: 'visionedge';
  baseUrl: string;      // e.g. 'http://192.168.1.100:8080'
  apiKey: string;       // VisionEdge API authentication token
  systemId?: string;    // Optional: target a specific VisionEdge system instance
}
```

**Implementation notes:**
- The WiPro VisionEdge API is REST-based. All HTTP calls go through `visionEdgeClient.ts`, a thin Axios wrapper that handles auth headers, base URL, and error normalization.
- `discoverEndpoints()` should call the VisionEdge endpoint/device list API and map each result to `DiscoveredEndpoint`. Preserve the native ID.
- `getEndpointState()` should call the VisionEdge status API for a single endpoint and map to `NormalizedEndpointState`.
- `sendCommand()` should dispatch to the appropriate VisionEdge API call based on `commandType` and parse the response back to `NormalizedEndpointState`.
- The VisionEdge API specifics are not hardcoded here — **research the actual WiPro VisionEdge REST API documentation before implementing** and build the client to match. Add a `visionEdgeTypes.ts` file with raw API response types, distinctly named from the shared types (e.g. `VEEndpointResponse`, `VECommandResponse`).

---

## 8. API ROUTES SPECIFICATION

### Authentication
```
POST   /api/auth/login           { email, password } → { accessToken, refreshToken, user }
POST   /api/auth/refresh         { refreshToken } → { accessToken }
POST   /api/auth/logout          { refreshToken } → 204
```

### Admin — Controllers
```
GET    /api/admin/controllers            List controllers for tenant
POST   /api/admin/controllers            Create controller { name, platform_slug, connection_config }
GET    /api/admin/controllers/:id        Get controller
PATCH  /api/admin/controllers/:id        Update controller
DELETE /api/admin/controllers/:id        Soft delete
POST   /api/admin/controllers/:id/test   Test connectivity (calls bridge agent)
POST   /api/admin/controllers/:id/poll   Trigger endpoint discovery (calls bridge agent)
```

### Admin — Endpoints
```
GET    /api/admin/endpoints              List endpoints (filterable by controller, assigned status)
PATCH  /api/admin/endpoints/:id          Update (display_name, assign to group, etc.)
POST   /api/admin/endpoints/bulk-assign  Assign multiple endpoints to a group
```

### Admin — Groups
```
GET    /api/admin/groups                 List groups
POST   /api/admin/groups                 Create group { name, type, venue_id }
GET    /api/admin/groups/:id             Get group + endpoints
PATCH  /api/admin/groups/:id             Update group
DELETE /api/admin/groups/:id             Soft delete
POST   /api/admin/groups/:id/endpoints   Add endpoints to group
DELETE /api/admin/groups/:id/endpoints/:endpointId  Remove endpoint from group
GET    /api/admin/groups/:id/qr          Get/regenerate QR code for group
```

### Admin — Channels
```
GET    /api/admin/channels               List channels for venue
POST   /api/admin/channels               Create channel manually
POST   /api/admin/channels/sync          Sync from controller (calls bridge discoverChannels)
PATCH  /api/admin/channels/:id           Update display name, logo, order
PATCH  /api/admin/channels/reorder       Bulk reorder
```

### Admin — Branding
```
GET    /api/admin/branding               Get branding config for venue
PUT    /api/admin/branding               Update branding config
POST   /api/admin/branding/logo          Upload logo (multipart)
```

### Control (End-User — No Auth Required)
```
GET    /api/control/:groupToken          Get group config + endpoint list + branding (public)
POST   /api/control/:groupToken/command  Send control command { endpointId, commandType, payload }
WS     /ws/control/:groupToken           Subscribe to real-time state updates for group endpoints
```

### QR Codes
```
GET    /api/qr/:groupToken               Redirect to hosted QR code image
GET    /api/qr/:groupToken/png           Download QR as PNG
GET    /api/qr/:groupToken/svg           Download QR as SVG
```

---

## 9. BRIDGE AGENT INTERNAL API

The bridge agent runs on port 4001 internally. It is **never exposed through Nginx** — only the api-server can call it. Add middleware to verify a shared internal secret on every request.

```
POST   /bridge/test/:controllerId        Test connection for a controller's config
POST   /bridge/discover/:controllerId    Discover endpoints for a controller
POST   /bridge/channels/:controllerId    Discover channels for a controller
GET    /bridge/state/:controllerId/:platformEndpointId   Get live endpoint state
POST   /bridge/command/:controllerId     Execute a control command
```

---

## 10. QR CODE SERVICE BEHAVIOR

- When a group is created, immediately generate a QR code and store the PNG at:  
  `./qr-storage/{tenant_slug}/{venue_slug}/{group_id}.png`
- The QR code encodes the full URL: `https://{HOST}/control/{group.access_token}`
- The file is served at `/qr/{group.access_token}.png` via Nginx static file serving.
- This URL is suitable for referencing as web content in IPTV systems (e.g., a WiPro VisionEdge overlay or web-channel that displays the QR code).
- Admins can trigger regeneration (new QR code, same access_token URL).
- Export endpoints allow PNG/SVG download at print-appropriate resolution (minimum 1200×1200px PNG).

---

## 11. BRANDING SYSTEM

The end-user control UI applies venue branding dynamically via CSS custom properties. Branding data is fetched at page load from `/api/control/:groupToken` and injected into `:root` before first render.

**CSS custom properties to support:**
```css
--brand-primary       /* Main color (e.g., team primary) */
--brand-secondary     /* Secondary color (e.g., team secondary) */
--brand-accent        /* Call-to-action / highlight color */
--brand-text-on-primary
--brand-text-on-secondary
--brand-logo-url
--brand-font-family   /* Web-safe or Google Font name */
--brand-button-radius /* px value — square to fully rounded */
```

The `BrandingProvider` React component fetches branding config and applies these variables to the root element. All UI components in `control-ui` use only these custom properties for colors, never hardcoded values.

**Embed support:** The control UI must function cleanly inside an iframe with no frame-busting code. Include a `?embed=true` query param that removes any top-level nav chrome for a clean embed experience.

---

## 12. WEBSOCKET REAL-TIME STATE

- The api-server maintains a WebSocket server.
- When a guest connects to `/ws/control/:groupToken`, the server:
  1. Validates the group token exists.
  2. Subscribes the socket to a Redis pub/sub channel keyed to the group.
  3. Sends the current known state of all group endpoints as the first message.
- When a control command succeeds, the api-server publishes the updated endpoint state to Redis, which fans out to all connected clients watching that group.
- State update message shape:
  ```json
  { "type": "STATE_UPDATE", "endpointId": "uuid", "state": { ...NormalizedEndpointState } }
  ```
- Implement a heartbeat (ping/pong) every 30 seconds to detect dead connections.

---

## 13. SECURITY REQUIREMENTS

1. **Auth**: JWT access tokens expire in 15 minutes. Refresh tokens expire in 7 days and are rotated on use. Store refresh tokens in DB (hashed) so they can be individually revoked. SSO users receive JWTs after completing the OIDC/SAML flow — the JWT layer is always the final auth mechanism regardless of login method.
2. **Tenant Isolation**: Every DB query in admin routes must be scoped by `tenant_id` derived from the authenticated user's JWT claims. No cross-tenant data access is possible regardless of user role.
3. **Credential Encryption**: Controller `connection_config` is encrypted before storage using AES-256-GCM with a server-side key from environment config. Decryption happens in the bridge agent only, never returned to clients.
4. **Internal Bridge API**: Protected by a shared secret (`BRIDGE_INTERNAL_SECRET` env var) sent as a `X-Internal-Secret` header on every api-server → bridge-agent request.
5. **Control UI**: Intentionally unauthenticated (guest use). Rate-limit control commands per IP per group: max 10 commands per 10 seconds.
6. **CORS**: Admin UI and Control UI origins are explicitly allowlisted in the API server config.
7. **Input Validation**: Use Zod for all request body validation at every route. Do not trust any client input.
8. **TLS/HTTPS**: All external traffic is HTTPS. Nginx handles TLS termination. See Section 13A.

---

## 13A. TLS / HTTPS CONFIGURATION

All user-facing traffic must be served over HTTPS from day one. Nginx handles TLS termination; internal service-to-service traffic (within the Docker network) remains plaintext HTTP.

### Certificate Management

The Admin UI provides a **TLS Certificate Management** page under Settings where an admin can:

1. **Import a wildcard certificate** (preferred) — upload a PEM-encoded certificate chain + private key pair. The system validates the cert chain, extracts SANs and expiry, and writes the files to a Docker-mounted volume (`/etc/nginx/certs/`).
2. **Generate a CSR** (fallback) — if the admin doesn't have a cert ready, generate a private key + CSR on the server. The admin downloads the CSR, submits it to their CA, and uploads the signed cert when ready.
3. **View certificate status** — display current cert subject, SANs, issuer, expiry date, and days until expiry. Warn at 30 days, alert at 7 days.

### Implementation Details

- Certificates are stored on a Docker volume mounted at `nginx/certs/` (mapped to `/etc/nginx/certs/` in the container).
- After a cert upload, the API server writes the files and sends an Nginx reload signal (`docker exec nginx nginx -s reload` or via a sidecar script).
- The Nginx config uses `ssl_certificate` and `ssl_certificate_key` directives pointing to the volume paths.
- For development, generate a self-signed cert during `docker-compose up` if no cert exists.
- Store certificate metadata (subject, SANs, expiry, uploaded_by, uploaded_at) in the `tls_certificates` DB table for audit trail.

### Nginx TLS Config Baseline

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### API Routes — TLS Management

```
GET    /api/admin/tls                 Get current certificate status (subject, SANs, expiry)
POST   /api/admin/tls/upload          Upload cert chain + private key (multipart PEM files)
POST   /api/admin/tls/csr             Generate CSR { commonName, sans[], organization, country }
GET    /api/admin/tls/csr/download    Download the most recent CSR
POST   /api/admin/tls/csr/complete    Upload signed cert to complete pending CSR
```

---

## 13B. SSO / IDENTITY PROVIDER INTEGRATION

SuiteCommand supports federated authentication via SSO alongside local username/password auth. The auth system is strategy-based: local auth and each SSO provider are independent Passport.js strategies. JWTs are always the session mechanism — SSO flows terminate by issuing a JWT pair, identical to local login.

### Supported Identity Providers (Phase 1)

| Provider | Protocol | Library | Priority |
|---|---|---|---|
| **Okta** | OIDC (OpenID Connect) | `passport-openidconnect` | Primary — implement first |
| **Entra ID (Azure AD)** | SAML 2.0 or OIDC | `passport-saml` or `passport-openidconnect` | Secondary |
| **Generic SAML** | SAML 2.0 | `passport-saml` | Fallback for any SAML IdP |
| **LDAP Import** | LDAP/LDAPS | `ldapjs` | User provisioning only (not runtime auth) |

### Architecture

- Each tenant can configure one or more identity providers (IdPs) in the `identity_providers` table.
- The IdP config stores protocol, client ID/secret (encrypted like controller credentials), metadata URL, and attribute mappings.
- SSO login flow: Admin UI redirects to `/api/auth/sso/:providerSlug` → Passport strategy redirects to IdP → callback at `/api/auth/sso/:providerSlug/callback` → JWT issued → redirect to Admin UI with token.
- User auto-provisioning: On first SSO login, if the user's email matches the tenant domain, create a user record with `auth_provider` set to the IdP slug and role defaulting to `operator`. Admins can pre-assign roles by email.
- LDAP sync is a batch import operation (not a login flow): an admin triggers a sync that reads users from LDAP, matches by email, and creates/updates user records.

### Database Additions

```typescript
identity_providers   // id, tenant_id, name, slug, protocol ('oidc' | 'saml' | 'ldap'),
                     //   config (jsonb, encrypted — clientId, clientSecret, metadata_url, etc.),
                     //   attribute_mapping (jsonb — maps IdP claims to SuiteCommand user fields),
                     //   is_active, created_at

// Extend users table:
//   + auth_provider: varchar — null for local, or identity_provider slug
//   + external_id: varchar — IdP subject/nameID for SSO users
```

### API Routes — SSO

```
GET    /api/admin/identity-providers           List configured IdPs for tenant
POST   /api/admin/identity-providers           Create IdP config
GET    /api/admin/identity-providers/:id       Get IdP config (secrets redacted)
PATCH  /api/admin/identity-providers/:id       Update IdP config
DELETE /api/admin/identity-providers/:id       Remove IdP
POST   /api/admin/identity-providers/:id/test  Test IdP connectivity / metadata fetch
POST   /api/admin/identity-providers/:id/sync  Trigger LDAP user sync (LDAP providers only)

GET    /api/auth/sso/:providerSlug             Initiate SSO login (redirect to IdP)
GET    /api/auth/sso/:providerSlug/callback    SSO callback (issues JWT, redirects to UI)
POST   /api/auth/sso/:providerSlug/metadata    SAML metadata endpoint (for IdP configuration)
```

### Cloud Auth Consideration (Phase 2)

The strategy-based auth architecture is compatible with adding AWS Cognito or Auth0 as an identity broker in Phase 2. In that scenario, the on-prem SSO strategies would be replaced by a single OIDC strategy pointed at the cloud identity broker, which in turn federates to customer IdPs. The JWT layer, tenant scoping, and user model remain unchanged. **Do not build Cognito integration in Phase 1** — just ensure the auth middleware accepts JWTs from any configured issuer.

---

## 13C. TRIGGER DASHBOARD

The Trigger Dashboard is an admin-facing feature that allows operators to define, manage, and execute automation scripts ("triggers") against groups of endpoints. This provides a scriptable layer on top of individual device control — for example, "game day mode" that sets all suite TVs to the house channel and raises volume, or "post-event" that powers everything down.

### Concepts

- **Trigger**: A named, reusable automation script consisting of an ordered list of actions. Scoped to a venue.
- **Trigger Action**: A single step within a trigger — a control command, a delay, or a conditional check.
- **Trigger State**: Triggers have states: `idle`, `running`, `completed`, `failed`, `cancelled`. Running triggers can be stopped.
- **Trigger Target**: A trigger targets one or more groups (or all endpoints in a venue). Target resolution happens at execution time, so group membership changes are reflected.

### Database Tables

```typescript
triggers             // id, venue_id, name, description, is_active, created_by (user_id),
                     //   created_at, updated_at, deleted_at

trigger_actions      // id, trigger_id, action_order, action_type ('command' | 'delay' | 'conditional'),
                     //   config (jsonb — command details, delay_ms, condition expression),
                     //   created_at

trigger_targets      // id, trigger_id, target_type ('group' | 'venue'), target_id (group or venue UUID)

trigger_executions   // id, trigger_id, started_by (user_id), state ('running' | 'completed' | 'failed' | 'cancelled'),
                     //   started_at, completed_at, error_message, execution_log (jsonb — per-action results)
```

### Action Types

- **command**: A `ControlCommand` sent to all endpoints in the target scope. Config: `{ commandType, payload }`.
- **delay**: Pause execution for N milliseconds. Config: `{ delayMs: number }`.
- **conditional**: Check endpoint state before proceeding. Config: `{ check: 'isPoweredOn', expect: true, onFail: 'skip' | 'abort' }`.

### Execution Model

- Trigger execution is asynchronous. The API returns immediately with an execution ID; the client polls or subscribes via WebSocket for progress.
- Actions execute sequentially. If an action fails, the trigger either continues (best-effort) or aborts, depending on the trigger's error policy.
- A running trigger can be cancelled by the user, which stops execution after the current action completes.
- Execution logs record the result of each action for post-run review.

### API Routes — Triggers

```
GET    /api/admin/triggers                     List triggers for venue
POST   /api/admin/triggers                     Create trigger
GET    /api/admin/triggers/:id                 Get trigger with actions and targets
PATCH  /api/admin/triggers/:id                 Update trigger metadata
DELETE /api/admin/triggers/:id                 Soft delete
POST   /api/admin/triggers/:id/actions         Add/replace action list
PUT    /api/admin/triggers/:id/targets         Set target groups
POST   /api/admin/triggers/:id/execute         Start trigger execution → { executionId }
POST   /api/admin/triggers/:id/cancel          Cancel running execution
GET    /api/admin/triggers/:id/executions      List past executions
GET    /api/admin/trigger-executions/:execId   Get execution detail + log
WS     /ws/trigger-executions/:execId          Subscribe to live execution progress
```

### Future Integration Points (Design Only — Not Phase 1)

- **VITEC Events / MoE Activities**: Triggers could be fired by external event systems via webhook. Add a `trigger_webhooks` table mapping an inbound webhook token to a trigger ID.
- **TriplePlay Event Triggers**: Same pattern — TriplePlay sends an HTTP POST to a webhook URL, SuiteCommand maps it to a trigger and executes.
- These integrations are adapter-pattern work: the trigger execution engine is platform-agnostic, only the invocation source changes.

---

## 14. ENVIRONMENT CONFIGURATION

Define all config in environment variables. Each service has its own `.env` file (`.env.api`, `.env.bridge`, `.env.admin`, `.env.control`). Provide `.env.example` files for all. Use Zod schemas to validate env vars at startup and fail fast with clear error messages if any required var is missing.

**Key environment variables:**

```env
# api-server
DATABASE_URL=postgresql://user:pass@postgres:5432/suitecommand
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=<random-256-bit>
JWT_REFRESH_SECRET=<random-256-bit>
CREDENTIAL_ENCRYPTION_KEY=<random-256-bit>
BRIDGE_AGENT_URL=http://bridge-agent:4001
BRIDGE_INTERNAL_SECRET=<random>
HOST=https://suitecommand.local  # Used for QR code URL generation
QR_STORAGE_PATH=/app/qr-storage
CORS_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3002
TLS_CERT_PATH=/etc/nginx/certs/server.crt
TLS_KEY_PATH=/etc/nginx/certs/server.key
TLS_CERT_STORAGE_PATH=/app/tls-storage

# bridge-agent
BRIDGE_INTERNAL_SECRET=<same as above>
API_SERVER_URL=http://api-server:4000
```

---

## 15. DOCKER COMPOSE CONFIGURATION

The Phase 1 `docker-compose.yml` must define the following services:
- `postgres` — PostgreSQL 16, with named volume, health check
- `redis` — Redis 7 Alpine, with named volume
- `api-server` — built from `services/api-server/Dockerfile`, depends on postgres + redis
- `bridge-agent` — built from `services/bridge-agent/Dockerfile`, depends on api-server; **not exposed externally**
- `admin-ui` — built from `apps/admin-ui/Dockerfile`
- `control-ui` — built from `apps/control-ui/Dockerfile`
- `nginx` — from `nginx/nginx.conf`, routes:
  - `/api/` → api-server:4000
  - `/ws/` → api-server:4000 (WebSocket upgrade)
  - `/qr/` → static files from qr-storage volume
  - `/admin/` → admin-ui:3001
  - `/control/` → control-ui:3002
  - `/` → control-ui:3002 (default)

Mount `qr-storage` as a shared named volume between `api-server` and `nginx` so Nginx can serve QR code images as static files.

---

## 16. PHASE 1 BUILD ORDER FOR CLAUDE CODE

Implement in this sequence to avoid circular dependencies and allow incremental testing:

1. **`packages/types`** — All shared interfaces, enums, and DTO types. No dependencies.
2. **Database schema + migrations** — Drizzle schema in api-server (incl. identity_providers, triggers, tls_certificates tables). Run `drizzle-kit generate` and validate.
3. **`services/bridge-agent` skeleton** — Adapter interface, registry, VisionEdge stub (returns mock data). Internal API routes.
4. **`services/api-server` foundation** — Express setup, middleware, auth routes (local + SSO/Passport.js), DB client, bridge client.
5. **Admin API routes** — Controllers, endpoints, groups, channels, branding, discovery, TLS management, identity providers, triggers (in that order).
6. **QR code service** — Generation and file hosting.
7. **Control API routes + WebSocket** — Public control endpoint and real-time state.
8. **Trigger execution engine** — Async trigger runner, execution logging, WebSocket progress.
9. **`apps/admin-ui`** — Full admin interface. Build pages in same order as API routes (incl. TLS settings, SSO config, trigger dashboard).
10. **`apps/control-ui`** — End-user control interface with branding system.
11. **VisionEdge adapter (real implementation)** — Replace stubs with actual VisionEdge API calls.
12. **Docker Compose + Nginx (HTTPS)** — Wire all services together with TLS. Self-signed cert for dev. Test full stack.
13. **Dev seed script** — Create default tenant, venue, admin user, sample trigger for local development.

---

## 17. WHAT NOT TO BUILD IN PHASE 1

- Audio control (Q-SYS, Omni) — adapter interface is ready, do not implement
- Lighting / environmental control — same
- Multi-tenant admin UI (meta-admin views) — data model is tenant-scoped, but UI shows single tenant only
- Cloud deployment tooling (Terraform, k8s manifests) — Docker Compose only
- Native mobile app embedding docs — web iframing only
- Payment / billing — not applicable yet
- Email / notification system
- AWS Cognito / Auth0 cloud identity broker — design is compatible, but do not integrate in Phase 1
- VITEC Events / TriplePlay webhook triggers — trigger engine supports it, but inbound webhook mapping is Phase 2
- LDAP runtime authentication — LDAP is import-only in Phase 1; runtime auth is local or SSO (OIDC/SAML)

---

## 18. CODING STANDARDS FOR THIS PROJECT

- **TypeScript strict mode** everywhere. No `any` types except in explicitly typed raw API response parsing.
- **Human-readable variable names.** No abbreviations except well-known ones (`id`, `url`, `db`, `ws`, `jwt`).
- **All functions and classes must have JSDoc comments** explaining purpose, params, and return values.
- **All files must have a top-level file header comment** stating what the file does and what service it belongs to.
- **No magic numbers or strings** — define constants or enums.
- **Error handling**: All async functions must either propagate typed errors or catch and re-throw with context. Use a custom `AppError` class with `code` and `statusCode` fields.
- **No business logic in route handlers** — routes call service functions; service functions call adapters or DB.
- Linting: ESLint with `@typescript-eslint/recommended` + `prettier` for formatting. Config at repo root.

---

## 19. TESTING EXPECTATIONS

- Unit tests for the adapter interface and VisionEdge adapter (mock HTTP responses with `msw` or `nock`).
- Integration tests for critical API routes using a test PostgreSQL instance (in-memory or Docker).
- The bridge agent adapter registry should be testable by registering a mock adapter.
- Use `vitest` as the test runner across all packages and services.

---

*End of SuiteCommand Phase 1 Specification*
*Generated as a Claude Code kickoff document — feed this as CLAUDE.md to Claude Code to begin scaffolding.*
