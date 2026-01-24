# Nginx for Tab-Sync-API reverse proxy
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="Tab-Sync-API Nginx Proxy" \
      org.opencontainers.image.description="Nginx reverse proxy for Tab-Sync-API"

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directories for additional config and certs
RUN mkdir -p /etc/nginx/conf.d /etc/nginx/certs

# Create self-signed cert for development (replace with real certs in production)
RUN apk add --no-cache openssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/certs/key.pem \
      -out /etc/nginx/certs/cert.pem \
      -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost" && \
    apk del openssl

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
