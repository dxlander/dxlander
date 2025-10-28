# Docker Deployment Guide

This guide explains how to build and deploy DXLander using Docker.

## Quick Start

### Using Pre-built Image (Recommended)

```bash
# Pull and run from GitHub Container Registry
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -v dxlander-data:/app/.dxlander \
  --name dxlander \
  ghcr.io/dxlander/dxlander:latest

# Access at http://localhost:3000
```

### Using Docker Compose

```bash
# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/dxlander/dxlander/main/docker-compose.yml

# Start DXLander
docker compose up -d

# View logs
docker compose logs -f

# Stop DXLander
docker compose down

# Stop and remove data
docker compose down -v
```

## Building Locally

### Build the Image

```bash
# Build for your platform
docker build -t dxlander:local .

# Build for multiple platforms (requires buildx)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t dxlander:local .
```

### Run Your Local Build

```bash
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -v dxlander-data:/app/.dxlander \
  --name dxlander \
  dxlander:local
```

## Configuration

### Environment Variables

| Variable                  | Default          | Description                       |
| ------------------------- | ---------------- | --------------------------------- |
| `NODE_ENV`                | `production`     | Node environment                  |
| `PORT`                    | `3000`           | Web UI port                       |
| `API_PORT`                | `3001`           | API server port                   |
| `DXLANDER_HOME`           | `/app/.dxlander` | Data directory                    |
| `DXLANDER_ENCRYPTION_KEY` | Auto-generated   | Master encryption key (32+ chars) |

### Volume Mounts

**Named Volume (Recommended for Production)**

```bash
docker run -v dxlander-data:/app/.dxlander ghcr.io/dxlander/dxlander:latest
```

**Bind Mount (Easier Access to Data)**

```bash
docker run -v ~/.dxlander:/app/.dxlander ghcr.io/dxlander/dxlander:latest
```

### Data Locations

Inside the container:

- **Database**: `/app/.dxlander/data/dxlander.db`
- **Projects**: `/app/.dxlander/projects/`
- **Encryption Key**: `/app/.dxlander/encryption.key`
- **Logs**: `/app/.dxlander/logs/`

## Advanced Usage

### Custom Port Mapping

```bash
docker run -d \
  -p 8080:3000 \
  -p 8081:3001 \
  -e PORT=3000 \
  -e API_PORT=3001 \
  ghcr.io/dxlander/dxlander:latest
```

### Using Custom Encryption Key

For production deployments, you can provide a custom encryption key via the `DXLANDER_ENCRYPTION_KEY` environment variable instead of relying on the auto-generated key file.

```bash
# Generate a secure 32+ character key
ENCRYPTION_KEY="your-custom-encryption-key-here-must-be-at-least-32-characters"

# Run with custom key (no key file will be generated)
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -e DXLANDER_ENCRYPTION_KEY=$ENCRYPTION_KEY \
  -v dxlander-data:/app/.dxlander \
  ghcr.io/dxlander/dxlander:latest
```

**Benefits of using DXLANDER_ENCRYPTION_KEY:**

- Works better in distributed deployments where multiple instances need to share the same key
- More suitable for container environments where file-based keys don't persist well
- Complies with organizational security requirements that mandate external key management
- Simplifies backup/restore scenarios by ensuring the same key is used across environments

**Security Requirements:**

- The key must be at least 32 characters long for security
- Keep the key secure and backed up
- For maximum security, use Docker secrets or Kubernetes secrets to manage the key

### Health Checks

The image includes a health check that polls `http://localhost:3000` every 30 seconds.

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' dxlander

# View health check logs
docker inspect --format='{{json .State.Health}}' dxlander | jq
```

## Docker Compose Examples

### Basic Setup

```yaml
version: '3.8'

services:
  dxlander:
    image: ghcr.io/dxlander/dxlander:latest
    ports:
      - '3000:3000'
      - '3001:3001'
    volumes:
      - dxlander-data:/app/.dxlander
    restart: unless-stopped

volumes:
  dxlander-data:
```

### With Custom Configuration

```yaml
version: '3.8'

services:
  dxlander:
    image: ghcr.io/dxlander/dxlander:latest
    ports:
      - '8080:3000'
      - '8081:3001'
    environment:
      - NODE_ENV=production
      - PORT=3000
      - API_PORT=3001
      - DXLANDER_ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - ./data:/app/.dxlander
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000']
      interval: 30s
      timeout: 10s
      retries: 3
```

### Behind Reverse Proxy (Nginx/Traefik)

```yaml
version: '3.8'

services:
  dxlander:
    image: ghcr.io/dxlander/dxlander:latest
    expose:
      - '3000'
      - '3001'
    volumes:
      - dxlander-data:/app/.dxlander
    restart: unless-stopped
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.dxlander.rule=Host(`dxlander.example.com`)'
      - 'traefik.http.services.dxlander.loadbalancer.server.port=3000'

volumes:
  dxlander-data:
```

## Maintenance

### Backup Data

```bash
# Backup volume to tar archive
docker run --rm \
  -v dxlander-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/dxlander-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Data

```bash
# Restore from backup
docker run --rm \
  -v dxlander-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/dxlander-backup-YYYYMMDD.tar.gz -C /data
```

### Update to Latest Version

```bash
# Using Docker
docker pull ghcr.io/dxlander/dxlander:latest
docker stop dxlander
docker rm dxlander
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -v dxlander-data:/app/.dxlander \
  --name dxlander \
  ghcr.io/dxlander/dxlander:latest

# Using Docker Compose
docker compose pull
docker compose up -d
```

### View Logs

```bash
# Using Docker
docker logs -f dxlander

# Using Docker Compose
docker compose logs -f

# Last 100 lines
docker logs --tail 100 dxlander
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs dxlander

# Check health status
docker inspect dxlander | grep -A 5 Health

# Verify ports are not in use
lsof -i :3000
lsof -i :3001
```

### Permission Issues

```bash
# Fix volume permissions
docker run --rm \
  -v dxlander-data:/data \
  alpine chown -R 1001:1001 /data
```

### Reset Everything

```bash
# Stop and remove container
docker stop dxlander
docker rm dxlander

# Remove volume (WARNING: Deletes all data)
docker volume rm dxlander-data

# Start fresh
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -v dxlander-data:/app/.dxlander \
  --name dxlander \
  ghcr.io/dxlander/dxlander:latest
```

## Build Process

The Docker image uses a multi-stage build that mirrors the npm production build:

1. **deps**: Install all dependencies
2. **builder**: Build workspace packages and bundle API with esbuild
3. **api-prod**: Deploy API with production dependencies using pnpm
4. **runner**: Final image with Next.js standalone + bundled API

This ensures:

- ✅ Small final image size
- ✅ Native modules work correctly (better-sqlite3)
- ✅ Standalone Next.js with embedded dependencies
- ✅ Production-optimized bundles

## Security Notes

- Container runs as non-root user `dxlander` (UID 1001)
- Encryption key auto-generated on first run (32+ character minimum enforced)
- For production, set `DXLANDER_ENCRYPTION_KEY` explicitly
- Use Docker secrets for sensitive environment variables
- Keep volumes backed up regularly

## Support

- **Documentation**: [documentation/](../documentation)
- **Issues**: [GitHub Issues](https://github.com/dxlander/dxlander/issues)
- **Discussions**: [GitHub Discussions](https://github.com/dxlander/dxlander/discussions)
