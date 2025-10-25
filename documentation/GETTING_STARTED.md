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
- API server: http://localhost:3001
- Web application: http://localhost:3000

### Access the Application

Navigate to http://localhost:3000 to access the setup wizard.

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
```

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

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both API and web in development |
| `pnpm build` | Build all packages and applications |
| `pnpm test` | Run test suites |
| `pnpm lint` | Check code style and formatting |
| `pnpm typecheck` | Verify TypeScript types |

## Environment Configuration

### Default Configuration

DXLander works out of the box with sensible defaults:

- **Database:** SQLite at `~/.dxlander/data/dxlander.db`
- **Storage:** Files at `~/.dxlander/projects/`
- **Encryption:** Auto-generated key at `~/.dxlander/encryption.key`

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
    └── configs/page.tsx    # Configuration management
```

### Shared Packages (`packages/`)

Common code shared between frontend and backend:

```typescript
// Key shared services
packages/shared/src/services/
├── encryption.ts    # Credential encryption
├── github.ts       # GitHub API integration
├── project.ts      # Project utilities
└── ai/             # AI prompt templates
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create route in `apps/api/src/routes/`
2. Add tRPC procedure definition
3. Update frontend to use new endpoint

### Adding a New Page

1. Create page component in `apps/web/app/`
2. Add to navigation if needed
3. Implement UI using design system components

### Adding a New Database Table

1. Update schema in `packages/database/src/schema.ts`
2. Generate migration with Drizzle
3. Update types and services

### Working with AI Features

1. Update prompts in `packages/shared/src/services/ai/prompts/`
2. Modify analysis logic in `packages/ai-agents/`
3. Test with various project types

## Design System

DXLander uses a custom **Ocean-themed** design system built on:

- **TailwindCSS v4** for styling
- **shadcn/ui** components (customized)
- **Satoshi** font family
- **Ocean blue** (#3b82f6) primary color

### Using Components

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Project Analysis</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="default">Generate Config</Button>
  </CardContent>
</Card>
```

## Debugging

### API Issues

- Check terminal for API server logs
- API runs on http://localhost:3001
- Database file: `~/.dxlander/data/dxlander.db`

### Frontend Issues

- Check browser console for errors
- Web app runs on http://localhost:3000
- Hot reloading enabled in development

### Database Issues

```bash
# View database contents
sqlite3 ~/.dxlander/data/dxlander.db

# Reset database (development only)
rm ~/.dxlander/data/dxlander.db
# Restart app to recreate
```

### Encryption Issues

```bash
# View encryption key
cat ~/.dxlander/encryption.key

# Reset encryption (development only - loses all credentials)
rm ~/.dxlander/encryption.key
# Restart app to regenerate
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