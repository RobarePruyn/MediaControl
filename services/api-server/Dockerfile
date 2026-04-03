# Dockerfile for @suitecommand/api-server
# Multi-stage build: install deps + build TypeScript, then run from slim image

# ---------------------------------------------------------------------------
# Stage 1 — Install dependencies and build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files needed for pnpm install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy all package.json files so pnpm can resolve the workspace graph
COPY packages/types/package.json packages/types/
COPY services/api-server/package.json services/api-server/
COPY services/bridge-agent/package.json services/bridge-agent/
COPY apps/admin-ui/package.json apps/admin-ui/
COPY apps/control-ui/package.json apps/control-ui/

# Install all workspace dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy shared types source and build it first (api-server depends on it)
COPY packages/types/ packages/types/
RUN pnpm --filter @suitecommand/types build

# Copy api-server source and build
COPY services/api-server/ services/api-server/
RUN pnpm --filter @suitecommand/api-server build

# ---------------------------------------------------------------------------
# Stage 2 — Production runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all workspace packages (pnpm needs the graph)
COPY packages/types/package.json packages/types/
COPY services/api-server/package.json services/api-server/
COPY services/bridge-agent/package.json services/bridge-agent/
COPY apps/admin-ui/package.json apps/admin-ui/
COPY apps/control-ui/package.json apps/control-ui/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/services/api-server/dist services/api-server/dist

# Copy drizzle migrations if they exist
COPY --from=builder /app/services/api-server/drizzle.config.ts services/api-server/

# Create QR storage directory
RUN mkdir -p /app/qr-storage

ENV NODE_ENV=production
EXPOSE 4000

WORKDIR /app/services/api-server
CMD ["node", "dist/index.js"]
