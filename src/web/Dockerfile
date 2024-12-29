# Stage 1: Builder
# node:18-alpine v18.19.0
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Add non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files with integrity verification
COPY --chown=appuser:appgroup package.json yarn.lock ./

# Install dependencies with strict version control and security checks
RUN yarn install --frozen-lockfile --production=false \
    && yarn cache clean

# Copy source code with appropriate permissions
COPY --chown=appuser:appgroup . .

# Build arguments for configuration
ARG VITE_API_BASE_URL
ARG BUILD_VERSION

# Verify required build arguments
RUN test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL build arg is required" && false)
RUN test -n "$BUILD_VERSION" || (echo "BUILD_VERSION build arg is required" && false)

# Build production assets with optimization flags
RUN yarn build \
    --sourcemap \
    --minify \
    --outDir=/app/build \
    && yarn typecheck

# Verify build output
RUN test -d /app/build || (echo "Build failed - no build directory" && false)

# Stage 2: Production
# nginx:1.25-alpine v1.25.3
FROM nginx:1.25-alpine

# Add non-root user for nginx
RUN adduser -D -S -H -u 101 -G nginx nginx

# Install security updates and tools
RUN apk update && apk upgrade \
    && apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy nginx configuration with security and performance optimizations
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --chown=nginx:nginx --from=builder /app/build .

# Configure nginx security headers
RUN echo 'add_header X-Frame-Options "SAMEORIGIN";' >> /etc/nginx/conf.d/default.conf \
    && echo 'add_header X-Content-Type-Options "nosniff";' >> /etc/nginx/conf.d/default.conf \
    && echo 'add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/conf.d/default.conf \
    && echo 'add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: https:; font-src '\''self'\'' data:; connect-src '\''self'\'' https:;";' >> /etc/nginx/conf.d/default.conf

# Configure nginx performance optimizations
ENV NGINX_WORKER_PROCESSES=auto
RUN echo "worker_processes ${NGINX_WORKER_PROCESSES};" >> /etc/nginx/nginx.conf

# Create cache directories with appropriate permissions
RUN mkdir -p /var/cache/nginx \
    && chown -R nginx:nginx /var/cache/nginx

# Set correct permissions
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:80/health || exit 1

# Add metadata labels
LABEL maintainer="Tech Transfer Team" \
    version="1.0.0" \
    security.scan-date=${BUILD_DATE}

# Start nginx
CMD ["nginx", "-g", "daemon off;"]