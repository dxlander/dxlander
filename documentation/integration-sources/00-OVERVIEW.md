# Config Services Feature

## Overview

The Config Services feature provides a flexible system for handling third-party service configurations (databases, caches, APIs, etc.) during deployment. It solves the problem of how to source credentials for detected services.

## Clean Architecture

DXLander has a **clean, consistent architecture** for managing credentials and services:

### 1. Secret Manager (Global Vault)

**Location**: `/dashboard/secrets`
**Purpose**: Reusable credential storage across all projects

- Store API keys, database connection strings, tokens
- Encrypted using AES-256-GCM
- Referenced by ID from Config Services
- One-time entry, use everywhere

### 2. Config Services (Per-Config Services)

**Location**: Config page → Services tab
**Purpose**: Per-config service configuration with modes

Each detected service can be configured with a **source mode**:

| Mode        | Description                                           | Use Case                                     |
| ----------- | ----------------------------------------------------- | -------------------------------------------- |
| `provision` | Create a new container as part of deployment          | Self-hosted: PostgreSQL, Redis, MongoDB      |
| `external`  | Use credentials from Secret Manager or enter manually | External: AWS RDS, Atlas MongoDB, Stripe API |
| `none`      | Skip this service (remove from docker-compose)        | Optional services, configure later           |

### 3. Environment Variables (Per-Config)

**Location**: Config page → Variables tab
**Purpose**: All other environment variables (PORT, NODE_ENV, etc.)

- User-editable env vars stored in `_summary.json`
- Values from Variables tab are included in deployment
- Config Service values override Variables tab values

## Source of Truth: Docker Compose

**Docker Compose is the source of truth** for all deployment configurations:

- AI generates `docker-compose.yml` during config generation
- All platforms (Docker, Vercel, Railway, etc.) derive their config from docker-compose
- The `composeServiceName` field tracks the exact service name for modifications

## User Flow

1. AI detects services during project analysis
2. Config services are created with `external` mode as default
3. User can:
   - Change source mode (provision, external, none)
   - Configure provision credentials (auto-generated or custom)
   - Enter external credentials (manual or reference from vault)
   - Edit service details (name, category, required vars)
4. During deployment:
   - **provision**: Container added to docker-compose, credentials auto-generated
   - **external**: Credentials resolved from vault or manual entry
   - **none**: Service removed from docker-compose using `composeServiceName`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Secret Manager                               │
│            (Global reusable credentials)                         │
│  ┌─────────────┬─────────────┬─────────────┐                    │
│  │ Production  │ Stripe API  │ SendGrid    │                    │
│  │ Database    │ Key         │ Key         │                    │
│  └─────────────┴─────────────┴─────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Referenced by ID
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Config Services                              │
│               (Per-config service configuration)                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐      │
│  │ PostgreSQL  │ Redis       │ Stripe      │ SendGrid    │      │
│  │ provision   │ provision   │ external    │ external    │      │
│  │ (container) │ (container) │ (vault ref) │ (manual)    │      │
│  └─────────────┴─────────────┴─────────────┴─────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Environment Variables                         │
│               (Variables tab - PORT, NODE_ENV, etc.)             │
│  ┌─────────────┬─────────────┬─────────────┐                    │
│  │ PORT=4678   │ NODE_ENV=   │ JWT_SECRET= │                    │
│  │             │ production  │ (value)     │                    │
│  └─────────────┴─────────────┴─────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Deployment Executor                          │
│  1. Load Variables tab env vars (_summary.json)                  │
│  2. Overlay Config Service env vars                              │
│  3. Modify docker-compose based on source modes                  │
│  4. Write .env file with all resolved vars                       │
│  5. Run docker compose up                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Provisionable Services

Services that can be self-hosted as Docker containers:

- **Databases**: PostgreSQL, MySQL, MariaDB, MongoDB
- **Cache**: Redis, Memcached
- **Search**: Elasticsearch
- **Storage**: MinIO (S3-compatible)
- **Queue**: RabbitMQ, Kafka

## Non-Provisionable (SaaS-only)

Services that require external accounts (use `external` mode):

- Email: SendGrid, Mailgun, SES
- Payment: Stripe, PayPal
- Auth: Auth0, Clerk
- AI: OpenAI, Anthropic
- Analytics: Mixpanel, Amplitude

## Security

- All credentials are encrypted using AES-256-GCM
- Vault credentials referenced by ID (never stored directly)
- Provisioned passwords are auto-generated (24 chars, alphanumeric)
- All credential decryption happens at deployment time only

## Future Platforms

When adding new deployment platforms (Vercel, Railway, etc.):

1. **Docker Compose is source of truth** - parse it to extract config
2. **Environment variables** come from `ConfigServiceService.getResolvedEnvVars()`
3. **Service modifications** use `composeServiceName` for accurate service removal
4. Each platform's executor should:
   - Read docker-compose.yml
   - Transform to platform-specific config
   - Use resolved env vars
   - Handle platform-specific deployment

## Related Files

- `apps/api/src/services/config-service.service.ts` - Service logic
- `apps/api/src/routes/config-services.ts` - API routes
- `apps/api/src/services/secret.service.ts` - Secret Manager service
- `apps/web/components/configuration/ServicesTab.tsx` - UI
- `apps/web/components/configuration/VariablesTab.tsx` - Variables UI

## Type Reference

| Type                      | Description                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ServiceSourceMode`       | `'provision' \| 'external' \| 'none'`                                                                                                                    |
| `ServiceCategory`         | `'database' \| 'cache' \| 'search' \| 'storage' \| 'queue' \| 'email' \| 'payment' \| 'auth' \| 'analytics' \| 'monitoring' \| 'ai' \| 'api' \| 'other'` |
| `ConfigService`           | Service configuration schema                                                                                                                             |
| `SerializedConfigService` | API response format                                                                                                                                      |
| `SecretCredentials`       | Per-field credential configuration                                                                                                                       |
