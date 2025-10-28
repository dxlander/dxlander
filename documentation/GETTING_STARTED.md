# Getting Started

This guide will get you up and running with DXLander locally for development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0.0 or higher
- **pnpm** 8.0.0 or higher - Install with `npm install -g pnpm`
- **Git** - For version control

## Installation

### Clone the Repository

```bash
git clone https://github.com/dxlander/dxlander.git
cd dxlander
```

### Install Dependencies

```bash
pnpm install
```

This installs all dependencies for the monorepo workspace.

### Start Development Servers

```bash
pnpm dev
```

This command starts both servers:

- API server: <http://localhost:3001>
- Web application: <http://localhost:3000>

### Access the Application

Navigate to <http://localhost:3000> to access the setup wizard.

## Initial Setup

The first-time setup wizard guides you through three steps:

1. Welcome screen
2. Admin account creation
3. Completion and redirect to dashboard

Setup creates the following directory structure:

```
~/.dxlander/
├── data/dxlander.db       # SQLite database
├── encryption.key         # Master encryption key
└── projects/              # Project storage
```

## Development Workflow

### Running Individual Services

Run services independently:

```bash
# Backend API only
pnpm dev:api

# Frontend web only
pnpm dev:web
```

### Building the Project

```bash
# Build everything
pnpm build

# Build specific packages
pnpm build:shared
pnpm build:database
pnpm build:api
pnpm build:web
```

### Running Tests

```bash
# All tests
pnpm test

# Specific test types
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

### Code Quality

```bash
# Linting
pnpm lint
pnpm lint:fix

# Type checking
pnpm typecheck

# Formatting
pnpm format          # Auto-format all files
pnpm format:check    # Check formatting without modifying
```

### Pre-commit Hooks

The project uses **Husky** and **lint-staged** to automatically run checks before commits:

```bash
# Install hooks (runs automatically after pnpm install)
pnpm prepare

# What runs on commit:
# - ESLint on staged .ts/.tsx/.js/.jsx files
# - Prettier formatting on all staged files
# - TypeScript type checking
```

If checks fail, your commit will be blocked. Fix the issues and try again.

## Project Structure

```
dxlander/
├── apps/
│   ├── api/          # Backend (localhost:3001)
│   └── web/          # Frontend (localhost:3000)
├── packages/
│   ├── shared/       # Common utilities
│   ├── database/     # Database schema
│   ├── ai-agents/    # AI services
│   ├── config-gen/   # Config generation
│   └── integrations/ # External integrations
├── bin/              # CLI entry point
└── documentation/    # This documentation
```

## Key Commands

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Start both API and web in development |
| `pnpm build`        | Build all packages and applications   |
| `pnpm test`         | Run test suites                       |
| `pnpm lint`         | Check code style and formatting       |
| `pnpm lint:fix`     | Auto-fix linting issues               |
| `pnpm format`       | Format all files with Prettier        |
| `pnpm format:check` | Check formatting without modifying    |
| `pnpm typecheck`    | Verify TypeScript types               |

## Environment Configuration

### Default Configuration

DXLander works out of the box with sensible defaults:

- **Database:** SQLite at `~/.dxlander/data/dxlander.db`
- **Storage:** Files at `~/.dxlander/projects/`
- **Encryption:** Auto-generated key at `~/.dxlander/encryption.key`

### Custom Encryption Key

For production deployments or enhanced security, you can provide a custom encryption key via the `DXLANDER_ENCRYPTION_KEY` environment variable:

```bash
# Generate a secure 44+ character base64 key (32 raw bytes encoded in base64 produce 44 characters)
export DXLANDER_ENCRYPTION_KEY=$(openssl rand -base64 32)
npx dxlander
```

This approach is recommended for:

- Multi-instance deployments where all instances need to share the same encryption key
- Container orchestration environments (Docker, Kubernetes) with secret management
- CI/CD pipelines where consistent encryption is needed across environments
- Disaster recovery scenarios where backups need to be restored with the correct encryption key

**Security Note:** The encryption key must be at least 44 characters long (32 raw bytes encoded in base64) to ensure adequate security for AES-256-GCM encryption.

## Understanding the Codebase

### API Server (`apps/api/`)

The backend uses **Hono** with **tRPC** for type-safe APIs:

```typescript
// Example API route structure
apps/api/src/routes/
├── auth.ts          # User authentication
├── projects.ts      # Project CRUD, GitHub import
├── ai-providers.ts  # AI service management
├── configs.ts       # Build configuration
└── settings.ts      # Application settings
```

### Web Application (`apps/web/`)

The frontend uses **Next.js 15** with the **App Router**:

```typescript
// Example page structure
apps/web/app/
├── page.tsx                 # Landing page
├── setup/page.tsx          # Setup wizard
├── login/page.tsx          # Authentication
├── dashboard/page.tsx      # Main dashboard
└── project/[id]/
    ├── page.tsx            # Project detail
```

### Encryption Issues

```bash
# View encryption key
cat ~/.dxlander/encryption.key

# Reset encryption (development only - loses all credentials)
rm ~/.dxlander/encryption.key
# Restart app to regenerate

# Using custom encryption key (production)
# Generate a secure 44+ character base64 key
export DXLANDER_ENCRYPTION_KEY=$(openssl rand -base64 32)
npx dxlander
```

## Troubleshooting

### Port Already in Use

Terminate processes using required ports:

```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Permission Issues

Ensure write permissions for the DXLander directory:

```bash
mkdir -p ~/.dxlander
chmod 755 ~/.dxlander
```

### Node Version Verification

Verify Node.js version meets the minimum requirement:

```bash
node --version  # Required: 18.0.0 or higher
```

## Next Steps

After setting up the development environment:

1. Explore the codebase structure in different packages and apps
2. Review the architecture documentation to understand system design
3. Test project import functionality using GitHub or ZIP upload
4. Check the issue tracker for contribution opportunities
5. Participate in discussions for questions and ideas

## Additional Resources

- Architecture documentation: [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)
- Feature documentation: [FEATURES_OVERVIEW.md](./FEATURES_OVERVIEW.md)
- Contributing guidelines: [CONTRIBUTING.md](../CONTRIBUTING.md)
- Issue tracker: GitHub Issues
- Community discussions: GitHub Discussions
