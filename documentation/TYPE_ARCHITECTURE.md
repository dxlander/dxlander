# Type Architecture Guide

---

## Overview

DXLander implements a **centralized type architecture** where all domain types are defined once in `packages/shared/src/types/` and shared across the entire monorepo (frontend, backend, and packages).

## Architecture

### 1. Centralized Type Definitions

All domain types live in `packages/shared/src/types/`:

```
packages/shared/src/types/
├── index.ts                 # Core domain models (Project, User, Deployment)
├── serialized.ts            # Serialized versions for API responses
├── integration-vault.ts     # Integration credential vault
├── deployment.ts            # Deployment credentials & platforms
├── config.ts               # Build configuration types
└── ai-providers.ts         # AI provider testing types
```

### 2. Serialization Pattern

**Problem:** tRPC serializes `Date` objects to ISO strings when sending over the wire.

**Solution:** We provide two versions of types with Date fields:

- **Backend types** - Use `Date` objects (matches database)
- **Frontend types** - Use `string` dates (matches API response)

```typescript
// Backend (packages/shared/src/types/index.ts)
export interface Project {
  id: string;
  name: string;
  createdAt: Date; // ← Date object
  updatedAt: Date; // ← Date object
}

// Frontend (packages/shared/src/types/serialized.ts)
export type SerializedProject = Omit<Project, 'createdAt' | 'updatedAt'> & {
  createdAt: string; // ← ISO string
  updatedAt: string; // ← ISO string
};
```

### 3. ESLint Enforcement

ESLint automatically catches duplicate type definitions:

```javascript
// eslint.config.mjs
'no-restricted-syntax': [
  'error',
  {
    selector: 'TSInterfaceDeclaration[id.name=/^(Project|Deployment|User|...)$/]',
    message: '❌ Do not redefine domain types. Import from @dxlander/shared instead.',
  },
  // ... same for type aliases
]
```

**Result:** Developers get immediate feedback when trying to redefine types.

---

## Type Organization

### File Structure

#### `index.ts` - Core Domain Models

Main domain types with `Date` objects (for backend use):

- `Project` - Project entity
- `User` - User entity
- `Deployment` - Deployment entity
- `ProjectFile` - File in a project
- Plus: Zod schemas, input types, etc.

#### `serialized.ts` - API Response Types

Serialized versions with `string` dates (for frontend use):

- `SerializedProject`
- `SerializedUser`
- `SerializedDeployment`
- `SerializedConfigSet`
- `SerializedIntegrationVaultEntry`
- `SerializedDeploymentCredential`

## Type Categories

### 1. Domain Models (Backend)

**When to use:** Backend services working with database records.

```typescript
import type { Project, User, Deployment } from '@dxlander/shared';

export class ProjectService {
  async getProject(id: string): Promise<Project> {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    return project; // Date objects from database
  }
}
```

**Key Domain Types:**

- `Project` - Project entity
- `User` - User entity
- `Deployment` - Deployment entity
- `IntegrationVaultEntry` - Integration credentials
- `DeploymentCredential` - Deployment platform credentials
- `ConfigSet` - Configuration set

### 2. Serialized Types (Frontend)

**When to use:** Frontend components receiving data from tRPC.

```typescript
import type { SerializedProject } from '@dxlander/shared';
import { formatDistanceToNow } from 'date-fns';

export default function ProjectCard({ project }: { project: SerializedProject }) {
  return (
    <div>
      <h3>{project.name}</h3>
      <p>Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</p>
    </div>
  );
}
```

### 3. Input Types (Validation)

**When to use:** Creating or updating resources with Zod validation.

```typescript
import { CreateProjectSchema, type CreateProjectInput } from '@dxlander/shared';

export const projectsRouter = router({
  create: protectedProcedure
    .input(CreateProjectSchema)
    .mutation(async ({ input, ctx }): Promise<Project> => {
      // input is validated and typed
      const project = await projectService.create(input);
      return project;
    }),
});
```

### 4. Service Types

**When to use:** Service-specific functionality.

```typescript
import type { DeploymentPlatform, ConfigType, ProviderTestConfig } from '@dxlander/shared';

// Deployment platform selection
const platform: DeploymentPlatform = 'vercel';

// Config generation
const configType: ConfigType = 'docker';

// AI provider testing
const testConfig: ProviderTestConfig = {
  provider: 'claude-code',
  apiKey: process.env.ANTHROPIC_API_KEY,
  settings: { model: 'claude-sonnet-4' },
};
```

---

## Usage Patterns

### Pattern 1: Backend tRPC Route

```typescript
// apps/api/src/routes/projects.ts
import { router, protectedProcedure, IdSchema } from '@dxlander/shared';
import type { Project } from '@dxlander/shared';

export const projectsRouter = router({
  get: protectedProcedure.input(IdSchema).query(async ({ input, ctx }): Promise<Project> => {
    // Returns Project with Date objects
    const project = await projectService.getById(input.id);
    return project;
  }),
});
```

**Key Points:**

- Return type is `Project` (with `Date` objects)
- tRPC automatically serializes dates to strings
- Frontend receives `SerializedProject`

### Pattern 2: Frontend Component

```typescript
// apps/web/app/dashboard/page.tsx
import type { SerializedProject } from '@dxlander/shared';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  // Type is automatically inferred as SerializedProject[]
  const { data: projects } = trpc.projects.list.useQuery();

  return (
    <div>
      {projects?.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: SerializedProject }) {
  return (
    <div>
      <h3>{project.name}</h3>
      <p>
        Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
      </p>
    </div>
  );
}
```

**Key Points:**

- Use `SerializedProject` type
- Dates are strings (ISO format)
- Convert to `Date` for formatting with `date-fns`

### Pattern 3: Extending Types

```typescript
// apps/web/app/dashboard/page.tsx
import type { SerializedProject } from '@dxlander/shared';

// ✅ GOOD - Extend with UI-specific fields
interface DashboardProject extends SerializedProject {
  isSelected?: boolean; // UI state
  lastActivity?: string; // Computed field
}

// ❌ BAD - Redefinition (ESLint will catch)
interface Project {
  id: string;
  name: string;
  // ... redefinition of all fields
}
```

**Key Points:**

- Use `extends` or `&` to add fields
- Don't redefine the entire type
- Only add UI-specific or computed fields

### Pattern 4: Type Aliases

```typescript
// ✅ GOOD - Type alias for convenience
import type { SerializedProject } from '@dxlander/shared';
type Project = SerializedProject;

// ❌ BAD - Redefinition
type Project = {
  id: string;
  name: string;
  // ...
};
```

### Pattern 5: Service Implementation

```typescript
// apps/api/src/services/project.service.ts
import type { Project, CreateProjectInput, UpdateProjectInput } from '@dxlander/shared';
import { db, schema } from '@dxlander/database';

export class ProjectService {
  async create(input: CreateProjectInput): Promise<Project> {
    const [project] = await db
      .insert(schema.projects)
      .values({
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return project;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const [project] = await db
      .update(schema.projects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.projects.id, id))
      .returning();
    return project;
  }
}
```

---

## Best Practices

### ✅ DO

1. **Import from Shared**

   ```typescript
   import type { Project, SerializedProject } from '@dxlander/shared';
   ```

2. **Use Serialized Types in Frontend**

   ```typescript
   const { data: projects } = trpc.projects.list.useQuery();
   // projects: SerializedProject[]
   ```

3. **Use date-fns for Formatting**

   ```typescript
   import { formatDistanceToNow, format } from 'date-fns';
   formatDistanceToNow(new Date(project.createdAt), { addSuffix: true });
   ```

4. **Extend Types When Needed**

   ```typescript
   interface UIProject extends SerializedProject {
     isSelected: boolean;
   }
   ```

5. **Add JSDoc to New Types**

   ````typescript
   /**
    * My new type description
    *
    * @example
    * ```typescript
    * const example: MyType = { ... };
    * ```
    */
   export interface MyType { ... }
   ````

6. **Use Zod Schemas for Validation**
   ```typescript
   export const CreateMyTypeSchema = z.object({ ... });
   export type CreateMyTypeInput = z.infer<typeof CreateMyTypeSchema>;
   ```

### ❌ DON'T

1. **Don't Redefine Domain Types**

   ```typescript
   // ❌ BAD
   interface Project {
     // ESLint error!
     id: string;
   }
   ```

2. **Don't Use any for API Responses**

   ```typescript
   // ❌ BAD
   const { data: projects } = trpc.projects.list.useQuery() as any;
   ```

3. **Don't Skip Serialization**

   ```typescript
   // ❌ BAD - Using Date type in frontend
   function Component({ project }: { project: Project }) {
     // project.createdAt is string, not Date!
   }
   ```

4. **Don't Use Custom Date Utilities**

   ```typescript
   // ❌ BAD - Custom utilities removed
   import { formatRelativeTime } from '@dxlander/shared/utils';

   // ✅ GOOD - Use date-fns
   import { formatDistanceToNow } from 'date-fns';
   ```

---

## Common Mistakes

### Mistake 1: Using Domain Type in Frontend

**❌ Problem:**

```typescript
// Frontend component
import type { Project } from '@dxlander/shared';

function ProjectCard({ project }: { project: Project }) {
  // project.createdAt is actually a string, not Date!
  return <div>{project.createdAt.toISOString()}</div>; // ❌ Error!
}
```

**✅ Solution:**

```typescript
import type { SerializedProject } from '@dxlander/shared';
import { formatDistanceToNow } from 'date-fns';

function ProjectCard({ project }: { project: SerializedProject }) {
  return <div>{formatDistanceToNow(new Date(project.createdAt))}</div>;
}
```

### Mistake 2: Redefining Types

**❌ Problem:**

```typescript
// Frontend component
type Project = {
  // ❌ ESLint error!
  id: string;
  name: string;
  // ... 15 more fields
};
```

**✅ Solution:**

```typescript
import type { SerializedProject } from '@dxlander/shared';
type Project = SerializedProject; // ✅ Type alias is OK
```

### Mistake 3: Not Using Zod Validation

**❌ Problem:**

```typescript
export const projectsRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string() }))  // ❌ Inline schema
    .mutation(async ({ input }) => { ... }),
});
```

**✅ Solution:**

```typescript
import { CreateProjectSchema } from '@dxlander/shared';

export const projectsRouter = router({
  create: protectedProcedure
    .input(CreateProjectSchema)  // ✅ Reusable schema
    .mutation(async ({ input }) => { ... }),
});
```

### Mistake 4: Ignoring ESLint Errors

**❌ Problem:**

```typescript
interface User {
  // ❌ ESLint: Do not redefine domain types
  id: string;
  email: string;
}
// Developer ignores error and commits
```

**✅ Solution:**

```typescript
import type { SerializedUser } from '@dxlander/shared';
// ✅ Use shared type instead
```

---
