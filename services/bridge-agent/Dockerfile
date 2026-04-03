# Dockerfile for @suitecommand/bridge-agent
# Multi-stage build: install deps + build TypeScript, then run from slim image

# ---------------------------------------------------------------------------
# Stage 1 — Install dependencies and build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ && \
    corepack enable && corepack prepare pnpm@9.15.4 --activate

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

# Copy shared types source and build it first (bridge-agent depends on it)
COPY packages/types/ packages/types/
RUN pnpm --filter @suitecommand/types build

# Copy bridge-agent source and build
COPY services/bridge-agent/ services/bridge-agent/
RUN pnpm --filter @suitecommand/bridge-agent build

# ---------------------------------------------------------------------------
# Stage 2 — Production runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

RUN apk add --no-cache python3 make g++ && \
    corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all workspace packages (pnpm needs the graph)
COPY packages/types/package.json packages/types/
COPY services/api-server/package.json services/api-server/
COPY services/bridge-agent/package.json services/bridge-agent/
COPY apps/admin-ui/package.json apps/admin-ui/
COPY apps/control-ui/package.json apps/control-ui/

# Install production dependencies only (bcrypt requires native build tools)
RUN pnpm install --frozen-lockfile --prod && \
    apk del python3 make g++

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/services/bridge-agent/dist services/bridge-agent/dist

ENV NODE_ENV=production
EXPOSE 4001

WORKDIR /app/services/bridge-agent
CMD ["node", "dist/index.js"]
