# Project Architecture

This document explains the technical structure of DXLander and how all the pieces fit together.

## Overview

DXLander is a TypeScript monorepo built with modern tools and best practices. It follows a microservices-inspired architecture where each package has a specific responsibility.

## Repository Structure

```
dxlander/
├── apps/                    # Applications (user-facing)
│   ├── api/                # Backend API server (Hono + tRPC)
│   └── web/                # Frontend web application (Next.js 15)
├── packages/               # Shared libraries and services
│   ├── shared/             # Common utilities and services
│   ├── database/           # Database layer and schema
│   ├── ai-agents/          # AI integration services
│   ├── config-gen/         # Configuration generation logic
│   └── integrations/       # External service integrations
├── bin/                    # CLI entry point
├── tests/                  # Test suites
└── documentation/          # documentation
```

## Applications (`apps/`)

### API Server (`apps/api/`)

**Technology:** Hono + Node.js + tRPC
**Port:** 3001 (development)
**Purpose:** Backend API providing all data and business logic

**Key Files:**

- `src/index.ts` - Server entry point, middleware setup
- `src/context.ts` - tRPC context creation (database, auth)
- `src/routes/` - API endpoints organized by feature
- `src/middleware/` - Authentication, setup detection, error handling
- `src/services/` - Business logic services

**Routes:**

- `/auth` - Authentication (login, logout, user management)
- `/setup` - First-time setup wizard
- `/projects` - Project CRUD, GitHub import, file management
- `/ai-providers` - AI service configuration (OpenAI, Claude, etc.)
- `/deployment-targets` - Deployment credential management
- `/configs` - Build configuration generation and management
- `/deployments` - Deployment tracking and execution
- `/settings` - Application settings and encryption key management

### Web Application (`apps/web/`)

**Technology:** Next.js 15 + React 19 + TailwindCSS v4
**Port:** 3000 (development)
**Purpose:** User interface for all DXLander functionality

**Key Directories:**

- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components
- `lib/` - Frontend utilities and configuration
- `public/` - Static assets (logos, icons, etc.)

**Design System:**

- **Theme:** Ocean-inspired (#3b82f6 primary color)
- **Font:** Satoshi font family
- **Components:** shadcn/ui with custom ocean theme
- **Styling:** TailwindCSS v4 with design tokens

**Key Pages:**

- `/` - Landing page with setup detection
- `/setup` - First-time setup wizard
- `/login` - User authentication
- `/dashboard` - Main project overview
- `/dashboard/import` - Project import (GitHub, ZIP upload)
- `/dashboard/deployments` - Deployment targets and credential management
- `/dashboard/settings` - Settings hub with card-based navigation
- `/dashboard/settings/ai-providers` - AI provider configuration
- `/dashboard/settings/security` - Security and encryption management
- `/dashboard/settings/database` - Database configuration and analytics
- `/dashboard/settings/backup` - Backup and restore management
- `/project/[id]` - Project detail and management
- `/project/[id]/configs` - Build configuration management

## Packages (`packages/`)

### Shared (`packages/shared/`)

**Purpose:** Common utilities, types, and services used across all applications

**Key Modules:**

- `src/services/encryption.ts` - AES-256-GCM encryption for credentials
- `src/services/github.ts` - GitHub API integration
- `src/services/gitlab.ts` - GitLab API integration
- `src/services/bitbucket.ts` - Bitbucket API integration
- `src/services/project.ts` - Project validation and utilities
- `src/services/project-structure.ts` - Centralized project directory structure management
- `src/services/file-storage.ts` - File system operations and path utilities
- `src/services/zip-upload.ts` - ZIP file extraction and processing
- `src/services/ai/` - AI prompt templates and types
- `src/types/` - Shared TypeScript types
- `src/utils/` - Common utility functions
- `src/constants/` - Application constants
- `src/trpc/` - tRPC router and procedure definitions

#### Type Architecture

DXLander follows a centralized type architecture where all domain types are defined in `packages/shared/src/types/` and shared across frontend and backend.

**Type Organization:**

```
packages/shared/src/types/
├── index.ts                 # Core domain models (Project, User, Deployment)
├── serialized.ts            # Serialized versions for API responses
├── integration-vault.ts     # Integration credential vault
├── deployment.ts            # Deployment credentials & platforms
├── config.ts               # Build configuration types
└── ai-providers.ts         # AI provider testing types
```

**Key Principles:**

1. **Single Source of Truth:** All domain types (Project, User, Deployment, etc.) are defined once in `packages/shared/src/types/`
2. **Serialization Pattern:** tRPC serializes `Date` objects to ISO strings. We provide `Serialized*` types for frontend use:
   - Backend uses `Project` (with `Date` objects)
   - Frontend uses `SerializedProject` (with `string` dates)
3. **ESLint Enforcement:** Duplicate type definitions are caught at lint time with `no-restricted-syntax` rules
4. **Import from Shared:** Always import types from `@dxlander/shared`, never redefine locally

**Example:**

```typescript
// ✅ Backend (apps/api/)
import type { Project } from '@dxlander/shared';
const project: Project = await db.query.projects.findFirst(...);
// project.createdAt is Date

// ✅ Frontend (apps/web/)
import type { SerializedProject } from '@dxlander/shared';
const { data: project } = trpc.projects.get.useQuery();
// project.createdAt is string

// ❌ DON'T DO THIS
interface Project { ... }  // ESLint error! Import from @dxlander/shared
```

**Type Categories:**

- **Domain Models:** Project, User, Deployment, Integration
- **Serialized Types:** SerializedProject, SerializedUser, SerializedDeployment
- **Input Schemas:** CreateProjectInput, UpdateProjectInput (with Zod validation)
- **Service Types:** DeploymentPlatformConfig, ProviderTestConfig
- **Configuration Types:** ConfigType, ConfigSet, GenerateConfigOptions

### Database (`packages/database/`)

**Technology:** SQLite (default) / PostgreSQL (optional) + Drizzle ORM
**Purpose:** Database schema, migrations, and query layer

**Key Files:**

- `src/schema.ts` - Complete database schema definition
- `src/db.ts` - Database connection and configuration
- `src/types.ts` - Database-derived TypeScript types
- `migrations/` - Database migration files

**Tables:**

- `users` - User accounts and authentication
- `projects` - Imported projects and metadata
- `aiProviders` - AI service configurations (encrypted)
- `buildConfigs` - Generated deployment configurations
- `deployments` - Deployment history and status
- `settings` - Application settings

### AI Agents (`packages/ai-agents/`)

**Purpose:** AI integration and prompt management for project analysis

**Key Features:**

- Framework detection (Next.js, React, Python, etc.)
- Dependency analysis (package.json, requirements.txt, etc.)
- Environment variable detection
- Integration identification (databases, APIs, services)
- Build configuration generation

### Config Generation (`packages/config-gen/`)

**Purpose:** Generate deployment configurations (Docker, Kubernetes, etc.)

**Templates:**

- Dockerfile generation for any project type
- Docker Compose for multi-service applications
- Kubernetes manifests for production deployment
- Bash scripts for VPS deployment

### Integrations (`packages/integrations/`)

**Purpose:** External service integrations and credential management

**Services:**

- Database connections (PostgreSQL, MySQL, MongoDB)
- Cloud storage (AWS S3, Google Cloud Storage)
- Authentication (Auth0, Firebase Auth, Supabase)
- Deployment platforms (Vercel, Railway, DigitalOcean)

## Data Flow

### 1. Project Import Flow

```
User uploads project → GitHub API → File extraction →
AI analysis → Framework detection → Configuration generation
```

### 2. Configuration Generation Flow

```
Project analysis → AI prompts → Template selection →
File generation → User review → Deployment ready
```

### 3. Deployment Flow (Planned)

```
Configuration ready → Target platform selection →
Credential injection → Deployment execution → Status tracking
```

## Database Architecture

### Storage Approach

- **Development:** SQLite at `~/.dxlander/data/dxlander.db`
- **Production:** PostgreSQL for teams and enterprise
- **File Storage:** Local filesystem at `~/.dxlander/projects/`

### Project Directory Structure

Each imported project follows a standardized structure to ensure consistent behavior across all import sources (GitHub, GitLab, Bitbucket, ZIP):

```
~/.dxlander/projects/{projectId}/
├── files/              # Imported source code
│   ├── package.json
│   ├── src/
│   └── ...
└── configs/            # Generated deployment configurations
    ├── {configId}/     # Docker configuration set
    ├── {configId}/     # Kubernetes configuration set
    └── ...
```

**Key Principles:**

- **Source files** are always stored in `{projectId}/files/` directory
- **Generated configs** are always stored in `{projectId}/configs/{configId}/` directories
- This structure prevents configs from mixing with source code
- Ensures AI analysis only reads source files, never generated configs
- Consistent across all import methods (GitHub, GitLab, Bitbucket, ZIP)

### Security

- **Encryption:** AES-256-GCM for all sensitive data
- **Key Management:** File-based storage or environment variable
- **Authentication:** JWT tokens with bcrypt password hashing

## Development Workflow

### Package Dependencies

```
apps/api → packages/shared, packages/database
apps/web → packages/shared
packages/shared → packages/database (types only)
```

### Build Order

1. `packages/shared` (foundational types and utils)
2. `packages/database` (schema and migrations)
3. `packages/ai-agents`, `packages/config-gen`, `packages/integrations`
4. `apps/api` (backend server)
5. `apps/web` (frontend application)

### Communication

- **API Communication:** tRPC (type-safe, auto-generated client)
- **Database:** Drizzle ORM with TypeScript integration
- **File System:** Node.js fs APIs with proper error handling

## Key Technologies

### Backend Stack

- **Runtime:** Node.js 18.0.0 or higher
- **Framework:** Hono (fast, lightweight)
- **API:** tRPC (type-safe RPC)
- **Database:** Drizzle ORM + SQLite/PostgreSQL
- **Authentication:** JWT + bcrypt

### Frontend Stack

- **Framework:** Next.js 15 (App Router)
- **React:** React 19 (latest)
- **Styling:** TailwindCSS v4
- **Components:** shadcn/ui (customized)
- **Type Safety:** Full TypeScript coverage

### DevOps & Tools

- **Package Manager:** pnpm (workspaces)
- **Linting:** ESLint + Prettier
- **Testing:** Vitest (unit, integration, e2e)
- **Type Checking:** TypeScript 5.4
- **CLI:** Custom CLI wrapper (`bin/dxlander.js`)

## Environment Setup

### Required Files

```
~/.dxlander/
├── encryption.key              # Master encryption key (CRITICAL)
├── data/dxlander.db           # SQLite database
└── projects/                   # Uploaded project files
```

### Environment Variables

- `DXLANDER_ENCRYPTION_KEY` - Master encryption key (44+ chars base64, production)
- `DATABASE_URL` - PostgreSQL connection (optional)
- `NODE_ENV` - Environment mode
- `PORT` - API server port (default: 3001)

## Security Considerations

### Encryption

- All API keys and credentials are encrypted before database storage
- Master encryption key can be provided via environment variable or file
- File permissions set to 0600 (owner read/write only)
- Minimum 44-character base64 key length enforced for security (32 raw bytes encoded in base64 produce 44 characters)

### Authentication

- JWT tokens for session management
- Password hashing with bcrypt
- Role-based access control (admin/user)

### Data Privacy

- No data sent to external services without explicit user consent
- Self-hosted by default (full user control)
- Secure credential storage with proper encryption

## Performance Considerations

### Database

- SQLite for single-user scenarios (fast, simple)
- PostgreSQL for multi-user and production deployments
- Indexed queries for common operations

### File Handling

- Streaming for large file uploads
- Compression for project archives
- Smart filtering to avoid binary files

### Caching

- Memoized AI analysis results
- Configuration template caching
- Static asset optimization
