# Database Relationships & Cascade Behavior

## Overview

This document describes the relationships between database tables and how data should be deleted when parent records are removed.

## Entity Relationship Diagram

```
users
  └── projects (userId)
      ├── analysisRuns (projectId)
      │   └── analysisActivityLogs (analysisRunId)
      ├── configSets (projectId)
      │   ├── configActivityLogs (configSetId)
      │   ├── configFiles (configSetId)
      │   └── configOptimizations (configSetId)
      ├── buildRuns (projectId)
      └── deployments (projectId)
```

## Cascade Delete Behavior

### When a Project is Deleted

**ALL related data should be deleted:**

- All `analysisRuns` for that project
  - All `analysisActivityLogs` for those analysis runs
- All `configSets` for that project
  - All `configActivityLogs` for those config sets
  - All `configFiles` for those config sets
  - All `configOptimizations` for those config sets
- All `buildRuns` for that project
- All `deployments` for that project

### When a Config Set is Deleted

**Related config data should be deleted:**

- All `configActivityLogs` for that config set
- All `configFiles` for that config set
- All `configOptimizations` for that config set

### When an Analysis Run is Deleted

**Related logs should be deleted:**

- All `analysisActivityLogs` for that analysis run

## Current Implementation Status

### ✅ Implemented

- Foreign key relationships defined in schema
- Indexes on foreign key columns

### ❌ Not Implemented (Tech Debt)

- SQLite foreign key constraints (need to enable `PRAGMA foreign_keys = ON`)
- Application-level cascade deletes
- Orphan record cleanup

## Foreign Key Constraints (SQLite)

SQLite supports foreign keys but they must be:

1. Enabled per connection: `PRAGMA foreign_keys = ON`
2. Defined in the schema with references

### Current Schema

The schema has implicit relationships (columns named `*Id`) but no explicit foreign key constraints.

### Recommended Schema Updates

```typescript
// Example: Add foreign key constraint to analysisRuns
export const analysisRuns = sqliteTable('analysis_runs', {
  // ... existing columns ...
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
});

// Example: Add foreign key constraint to analysisActivityLogs
export const analysisActivityLogs = sqliteTable('analysis_activity_logs', {
  // ... existing columns ...
  analysisRunId: text('analysis_run_id')
    .notNull()
    .references(() => analysisRuns.id, { onDelete: 'cascade' }),
});
```

## Application-Level Cascade (Current Approach)

Since we haven't enabled foreign key constraints yet, we handle cascades in the application layer:

### Project Deletion

```typescript
// apps/api/src/services/project.service.ts
async deleteProject(projectId: string) {
  // 1. Delete all analysis activity logs
  const analyses = await db.query.analysisRuns.findMany({
    where: eq(schema.analysisRuns.projectId, projectId),
  });

  for (const analysis of analyses) {
    await db.delete(schema.analysisActivityLogs)
      .where(eq(schema.analysisActivityLogs.analysisRunId, analysis.id));
  }

  // 2. Delete all analysis runs
  await db.delete(schema.analysisRuns)
    .where(eq(schema.analysisRuns.projectId, projectId));

  // 3. Delete all config-related data
  const configSets = await db.query.configSets.findMany({
    where: eq(schema.configSets.projectId, projectId),
  });

  for (const configSet of configSets) {
    await db.delete(schema.configActivityLogs)
      .where(eq(schema.configActivityLogs.configSetId, configSet.id));
    await db.delete(schema.configFiles)
      .where(eq(schema.configFiles.configSetId, configSet.id));
    await db.delete(schema.configOptimizations)
      .where(eq(schema.configOptimizations.configSetId, configSet.id));
  }

  await db.delete(schema.configSets)
    .where(eq(schema.configSets.projectId, projectId));

  // 4. Delete build runs and deployments
  await db.delete(schema.buildRuns)
    .where(eq(schema.buildRuns.projectId, projectId));
  await db.delete(schema.deployments)
    .where(eq(schema.deployments.projectId, projectId));

  // 5. Finally, delete the project
  await db.delete(schema.projects)
    .where(eq(schema.projects.id, projectId));
}
```

### Config Set Deletion

```typescript
async deleteConfigSet(configSetId: string) {
  // Delete all related data
  await db.delete(schema.configActivityLogs)
    .where(eq(schema.configActivityLogs.configSetId, configSetId));
  await db.delete(schema.configFiles)
    .where(eq(schema.configFiles.configSetId, configSetId));
  await db.delete(schema.configOptimizations)
    .where(eq(schema.configOptimizations.configSetId, configSetId));

  // Delete the config set
  await db.delete(schema.configSets)
    .where(eq(schema.configSets.id, configSetId));
}
```

## Failed Configuration Tracking

### Current Behavior

- Failed analysis runs are stored in `analysisRuns` with `status = 'failed'`
- Failed config generation stored in `configSets` with `status = 'failed'`
- Logs are preserved in `analysisActivityLogs` and `configActivityLogs`

### Querying Failed Attempts

```typescript
// Get all failed analysis runs for a project
const failedAnalyses = await db.query.analysisRuns.findMany({
  where: and(
    eq(schema.analysisRuns.projectId, projectId),
    eq(schema.analysisRuns.status, 'failed')
  ),
  orderBy: desc(schema.analysisRuns.createdAt),
});

// Get all failed config generations for a project
const failedConfigs = await db.query.configSets.findMany({
  where: and(eq(schema.configSets.projectId, projectId), eq(schema.configSets.status, 'failed')),
  orderBy: desc(schema.configSets.createdAt),
});
```

### UI for Failed Attempts

Create a new tab or section to show:

- **Failed Analyses**: List of failed analysis attempts with error messages
- **Failed Configs**: List of failed configuration generations
- Allow users to retry or delete failed attempts
- Show full error logs for debugging

## Recommendations

### Short-term (Immediate)

1. ✅ Document current deletion behavior (this document)
2. Implement application-level cascade deletes in project/config deletion endpoints
3. Add UI to view/manage failed attempts

### Medium-term (Next Sprint)

1. Enable SQLite foreign key constraints
2. Add foreign key references to schema
3. Test cascade behavior thoroughly
4. Create database migration

### Long-term (Future)

1. Add database-level triggers for audit logging
2. Implement soft deletes for better recovery
3. Add orphan record cleanup job

## Related Files

- Schema: `packages/database/src/schema.ts`
- Project Service: `apps/api/src/services/project.service.ts`
- Config Service: `apps/api/src/services/config.service.ts`
- AI Analysis Service: `apps/api/src/services/ai-analysis.service.ts`

## References

- [SQLite Foreign Key Documentation](https://www.sqlite.org/foreignkeys.html)
- [Drizzle ORM Foreign Keys](https://orm.drizzle.team/docs/rqb#foreign-keys)
