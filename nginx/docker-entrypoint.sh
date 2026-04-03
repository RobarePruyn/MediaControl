#!/bin/sh
# SuiteCommand — Nginx entrypoint script
# Generates a self-signed TLS certificate if none exists, then starts nginx.

set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="${CERT_DIR}/server.crt"
KEY_FILE="${CERT_DIR}/server.key"

# Create cert directory if it does not exist
mkdir -p "${CERT_DIR}"

# Generate a self-signed certificate if no certificate is present
if [ ! -f "${CERT_FILE}" ] || [ ! -f "${KEY_FILE}" ]; then
    echo "[suitecommand] No TLS certificate found. Generating self-signed certificate for development..."
    openssl req -x509 \
        -nodes \
        -days 365 \
        -newkey rsa:2048 \
        -keyout "${KEY_FILE}" \
        -out "${CERT_FILE}" \
        -subj "/C=US/ST=Development/L=Local/O=SuiteCommand/OU=Dev/CN=suitecommand.local" \
        -addext "subjectAltName=DNS:suitecommand.local,DNS:localhost,IP:127.0.0.1"
    echo "[suitecommand] Self-signed certificate generated at ${CERT_DIR}"
else
    echo "[suitecommand] TLS certificate found. Using existing certificate."
fi

# Start nginx in foreground
exec nginx -g "daemon off;"
