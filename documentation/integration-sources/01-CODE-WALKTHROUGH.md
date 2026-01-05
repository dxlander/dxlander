# Config Services - Code Walkthrough

## File Structure

```
packages/
├── shared/src/types/
│   ├── config-service.ts      # Config service types & utilities
│   └── secret.ts              # Secret Manager types
├── database/src/
│   ├── schema.ts              # Database schema (configServices table)
│   └── db.ts                  # Database initialization
apps/
├── api/src/
│   ├── routes/
│   │   ├── config-services.ts # tRPC router for config services
│   │   └── secrets.ts         # tRPC router for Secret Manager
│   └── services/
│       ├── config-service.service.ts  # Core config service logic
│       ├── secret.service.ts          # Secret Manager logic
│       └── deployment-executor.service.ts # Uses config services for deployment
├── web/components/configuration/
│   ├── ServicesTab.tsx        # Config services UI
│   └── VariablesTab.tsx       # Environment variables UI
```

## Backend Code Reference

### Database Schema (`packages/database/src/schema.ts`)

```typescript
export const configServices = sqliteTable(
  'config_services',
  {
    id: text('id').primaryKey(),
    configSetId: text('config_set_id').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    detectedFrom: text('detected_from'),
    isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(true),
    isProvisionable: integer('is_provisionable', { mode: 'boolean' }).notNull().default(false),
    knownService: text('known_service'),
    requiredEnvVars: text('required_env_vars'),
    notes: text('notes'),
    isEdited: integer('is_edited', { mode: 'boolean' }).notNull().default(false),
    composeServiceName: text('compose_service_name'),
    sourceMode: text('source_mode').notNull().default('external'),
    provisionConfig: text('provision_config'),
    secretCredentials: text('secret_credentials'),
    generatedEnvVars: text('generated_env_vars'),
    orderIndex: integer('order_index').default(0),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => ({
    configSetIdIdx: index('config_services_config_set_id_idx').on(table.configSetId),
    sourceModeIdx: index('config_services_source_mode_idx').on(table.sourceMode),
    categoryIdx: index('config_services_category_idx').on(table.category),
  })
);
```

### Service Layer (`apps/api/src/services/config-service.service.ts`)

Key methods:

| Method                         | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `createFromDetectedServices()` | Creates config services from AI-detected services |
| `createConfigService()`        | Creates a single config service                   |
| `getConfigServices()`          | Lists all config services for a config set        |
| `getConfigService()`           | Gets a single config service by ID                |
| `updateConfigService()`        | Updates a config service                          |
| `deleteConfigService()`        | Deletes a config service                          |
| `configureProvision()`         | Configures provision mode with credentials        |
| `configureExternal()`          | Configures external mode with credentials         |
| `getSecretCredentials()`       | Gets secret credentials (masked)                  |
| `getResolvedEnvVars()`         | Gets all resolved env vars for deployment         |

### API Routes (`apps/api/src/routes/config-services.ts`)

| Route                                     | Method   | Description                           |
| ----------------------------------------- | -------- | ------------------------------------- |
| `configServices.list`                     | Query    | List config services for a config set |
| `configServices.get`                      | Query    | Get a single config service           |
| `configServices.createFromDetected`       | Mutation | Create from AI-detected services      |
| `configServices.create`                   | Mutation | Create a single config service        |
| `configServices.update`                   | Mutation | Update a config service               |
| `configServices.delete`                   | Mutation | Delete a config service               |
| `configServices.configureProvision`       | Mutation | Configure provision mode              |
| `configServices.configureExternal`        | Mutation | Configure external mode               |
| `configServices.getSecretCredentials`     | Query    | Get credentials structure             |
| `configServices.getResolvedEnvVars`       | Query    | Get resolved env var keys             |
| `configServices.getProvisionableServices` | Query    | List provisionable services           |
| `configServices.getCategories`            | Query    | List service categories               |

## Frontend Code Reference

### ServicesTab Component (`apps/web/components/configuration/ServicesTab.tsx`)

Key functions:

| Function                          | Description                           |
| --------------------------------- | ------------------------------------- |
| `handleSourceModeChange()`        | Changes the source mode for a service |
| `handleToggleExpand()`            | Expands/collapses service details     |
| `handleSaveExternalCredentials()` | Saves external credentials            |
| `handleAddService()`              | Adds a new manual service             |

State management:

- `sources` - Config services from API
- `expandedId` - Currently expanded service ID
- `editingSource` - Service being edited
- `customCredentials` - Credential values being entered
- `showCredentials` - Which credential fields are visible

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         ServicesTab                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ trpc.configServices.list.useQuery({ configSetId })         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ sources.map(source => <ServiceCard />)                      │ │
│  │   - Show mode selector (provision/external/none)            │ │
│  │   - Show credentials input (for external mode)              │ │
│  │   - Show service details (category, env vars)               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Integration

### DeploymentExecutorService (`apps/api/src/services/deployment-executor.service.ts`)

The deployment executor uses config services to:

1. **Load config services** for the config set
2. **Process docker-compose.yml** based on source modes:
   - `provision`: Add/keep the service container
   - `external`: Remove service from compose (use external)
   - `none`: Remove service from compose (skip)
3. **Resolve environment variables** from config services
4. **Write .env file** with all resolved variables
5. **Run docker compose up**

Key code sections:

```typescript
// Get config services to process docker-compose based on user choices
const configServices = await ConfigServiceService.getConfigServices(userId, configSetId);

for (const configService of configServices) {
  const composeServiceName = configService.composeServiceName;

  if (configService.sourceMode === 'provision') {
    // Keep or add the service for provision mode
    // ...
  } else if (configService.sourceMode === 'external' || configService.sourceMode === 'none') {
    // Remove the service from docker-compose
    if (composeServiceName && composeDoc.services[composeServiceName]) {
      delete composeDoc.services[composeServiceName];
      // ...
    }
  }
}

// Get resolved environment variables from config services
const envVars = await ConfigServiceService.getResolvedEnvVars(userId, configSetId);
```

## Type Definitions

### ServiceSourceMode

```typescript
export const ServiceSourceModeSchema = z.enum(['provision', 'external', 'none']);
export type ServiceSourceMode = z.infer<typeof ServiceSourceModeSchema>;
```

### ServiceCategory

```typescript
export const ServiceCategorySchema = z.enum([
  'database', // PostgreSQL, MySQL, MongoDB, etc.
  'cache', // Redis, Memcached
  'search', // Elasticsearch, Meilisearch
  'storage', // MinIO, S3
  'queue', // RabbitMQ, Kafka
  'email', // SendGrid, Mailgun, SES
  'payment', // Stripe, PayPal
  'auth', // Auth0, Clerk
  'analytics', // Mixpanel, Amplitude
  'monitoring', // Sentry, DataDog
  'ai', // OpenAI, Anthropic
  'api', // Generic external APIs
  'other', // Unknown/custom
]);
```

### SecretCredentials

```typescript
export const SecretCredentialFieldSchema = z.object({
  type: z.enum(['manual', 'reference']),
  value: z.string().optional(), // For type='manual' (encrypted)
  secretId: z.string().optional(), // For type='reference'
  secretKey: z.string().optional(), // For type='reference'
});

export const SecretCredentialsSchema = z.record(SecretCredentialFieldSchema);
```

## How to Modify

### Adding a new source mode

1. Update `ServiceSourceModeSchema` in `packages/shared/src/types/config-service.ts`
2. Update `SOURCE_MODE_INFO` in `apps/web/components/configuration/ServicesTab.tsx`
3. Add mode button in ServicesTab UI
4. Handle mode in `deployment-executor.service.ts`

### Adding a new service category

1. Update `ServiceCategorySchema` in `packages/shared/src/types/config-service.ts`
2. Update `getServiceCategories()` function
3. Update `getCategoryIcon()` in ServicesTab.tsx

### Adding a new provisionable service

1. Add to `KnownProvisionableServiceSchema` in config-service.ts
2. Add configuration to `PROVISIONABLE_SERVICES` object
3. Include `dockerComposeService()` template function
