# DXLander Docker Image
# Optimized for minimal size - dependencies installed on first run
# 
# Build Instructions:
#   1. Build production artifacts: pnpm run build:production
#   2. Build Docker image: docker build -t dxlander .
#   3. Run: docker run -p 3000:3000 -p 3001:3001 dxlander
#
# Or use docker-compose: docker-compose up

FROM node:18-alpine

# Install only essential runtime dependencies
RUN apk add --no-cache curl dumb-init

WORKDIR /app

# Copy pre-built production artifacts (no node_modules)
COPY dist-production/ ./

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    API_PORT=3001 \
    NEXT_TELEMETRY_DISABLED=1

# Create non-root user and set permissions
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 dxlander && \
    mkdir -p /app/.dxlander/data /app/.dxlander/projects && \
    chown -R dxlander:nodejs /app /app/.dxlander && \
    chmod +x /app/bin/dxlander

# Switch to non-root user
USER dxlander

# Expose ports for Web UI and API
EXPOSE 3000 3001

# Health check to ensure services are running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/setup/status || exit 1

# Use dumb-init to handle signals properly and start the application
# Dependencies will be installed automatically on first run
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "bin/dxlander"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/setup/status || exit 1

# Start both API and Web servers
CMD ["node", "bin/dxlander"]
