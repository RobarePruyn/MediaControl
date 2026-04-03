# Dockerfile for @suitecommand/control-ui
# Multi-stage: build with pnpm + Vite, then serve static files via nginx

# ---------------------------------------------------------------------------
# Stage 1 — Install dependencies and build with Vite
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

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy and build shared types first (control-ui depends on it)
COPY packages/types/ packages/types/
RUN pnpm --filter @suitecommand/types build

# Copy control-ui source and build
COPY apps/control-ui/ apps/control-ui/
RUN pnpm --filter @suitecommand/control-ui build

# ---------------------------------------------------------------------------
# Stage 2 — Serve static assets with nginx
# ---------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Remove default nginx site
RUN rm -rf /usr/share/nginx/html/*

# Copy built Vite output
COPY --from=builder /app/apps/control-ui/dist /usr/share/nginx/html

# Nginx config to serve the SPA correctly
RUN cat > /etc/nginx/conf.d/default.conf << 'NGINX'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
