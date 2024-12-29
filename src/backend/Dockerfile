# -----------------------------
# Stage 1: Builder
# -----------------------------
FROM node:16-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with exact versions and security audit
RUN npm ci && \
    npm audit && \
    # Keep only required tools for building
    apk del python3 make g++

# Copy source code and config files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript application
RUN npm run build && \
    # Generate source maps
    npm run build -- --sourceMap && \
    # Clean dev dependencies
    npm prune --production

# -----------------------------
# Stage 2: Production
# -----------------------------
FROM node:16-alpine

# Set labels for container metadata
LABEL maintainer="DevOps Team" \
      version="${BUILD_VERSION:-1.0.0}" \
      security.scan-date="${SCAN_DATE:-2024-02-20}" \
      com.docker.compose.project="tech-transfer-backend"

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache curl tini && \
    # Create non-root user/group
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    # Create required directories with proper permissions
    mkdir -p /app/dist /app/node_modules /tmp && \
    chown -R appuser:appgroup /app /tmp

# Copy package files and install production dependencies
COPY --chown=appuser:appgroup package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Set security-related environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384" \
    PROM_METRICS_PORT=9090

# Configure security options
RUN chmod -R 550 /app/dist && \
    chmod -R 550 /app/node_modules && \
    # Ensure temp directory is writable
    chmod 1777 /tmp

# Expose ports for application and metrics
EXPOSE $PORT $PROM_METRICS_PORT

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Switch to non-root user
USER appuser

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with clustering enabled
CMD ["node", "dist/cluster.js"]

# Configure volumes
VOLUME ["/app/node_modules", "/tmp"]

# Set security options
SECURITY_OPTS --security-opt=no-new-privileges:true \
             --security-opt=seccomp=unconfined \
             --cap-drop=ALL \
             --cap-add=NET_BIND_SERVICE \
             --read-only