# Dockerfile for SuiteCommand nginx reverse proxy
# Includes entrypoint that generates self-signed certs for development

FROM nginx:alpine

# Install openssl for self-signed certificate generation
RUN apk add --no-cache openssl

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create directories for QR storage and certs
RUN mkdir -p /app/qr-storage /etc/nginx/certs

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
