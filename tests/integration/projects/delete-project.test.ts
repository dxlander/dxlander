import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, rmSync, readFileSync } from 'fs';

import { execSync } from 'child_process';
import { join } from 'path';
import { randomBytes } from 'crypto';

// Test configuration
const TEST_PROJECT_DIR = join(process.cwd(), '.test-projects');

describe('Delete Project Implementation Verification', () => {
  let projectId: string;
  let projectPath: string;

  beforeAll(() => {
    // Create a test project directory
    projectId = randomBytes(16).toString('hex');
    projectPath = join(TEST_PROJECT_DIR, projectId);

    // Create test project structure
    execSync(`mkdir -p "${projectPath}/files"`, { stdio: 'ignore' });
    execSync(`mkdir -p "${projectPath}/configs"`, { stdio: 'ignore' });

    // Create test files
    execSync(`echo '{"name": "test-project"}' > "${projectPath}/files/package.json"`, {
      stdio: 'ignore',
    });
    execSync(`echo 'FROM node:18\nWORKDIR /app' > "${projectPath}/configs/Dockerfile"`, {
      stdio: 'ignore',
    });
  });

  afterAll(() => {
    // Cleanup test directory
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  describe('File System Operations', () => {
    it('should create project directory structure', () => {
      expect(existsSync(projectPath)).toBe(true);
      expect(existsSync(join(projectPath, 'files'))).toBe(true);
      expect(existsSync(join(projectPath, 'configs'))).toBe(true);
      expect(existsSync(join(projectPath, 'files/package.json'))).toBe(true);
      expect(existsSync(join(projectPath, 'configs/Dockerfile'))).toBe(true);
    });

    it('should verify deleteProjectFiles function exists', () => {
      // Check if the function is exported in the shared package
      try {
        const sharedPath = join(process.cwd(), 'packages/shared/src/services/file-storage.ts');
        const content = readFileSync(sharedPath, 'utf8');
        expect(content).toContain('export function deleteProjectFiles');
      } catch (_error) {
        // If file doesn't exist in this location, check alternatives
        const files = ['packages/shared/src/index.ts', 'packages/shared/dist/index.js'];

        let found = false;
        for (const file of files) {
          try {
            const content = readFileSync(join(process.cwd(), file), 'utf8');
            if (content.includes('deleteProjectFiles')) {
              found = true;
              break;
            }
          } catch (_e) {
            // Continue checking
          }
        }
        expect(found).toBe(true);
      }
    });

    it('should simulate file deletion', () => {
      // Verify files exist before deletion
      expect(existsSync(join(projectPath, 'files/package.json'))).toBe(true);
      expect(existsSync(join(projectPath, 'configs/Dockerfile'))).toBe(true);

      // Simulate deletion
      rmSync(join(projectPath, 'files/package.json'));
      rmSync(join(projectPath, 'configs/Dockerfile'));

      // Verify files are deleted
      expect(existsSync(join(projectPath, 'files/package.json'))).toBe(false);
      expect(existsSync(join(projectPath, 'configs/Dockerfile'))).toBe(false);

      // Restore for other tests
      execSync(`echo '{"name": "test-project"}' > "${projectPath}/files/package.json"`, {
        stdio: 'ignore',
      });
      execSync(`echo 'FROM node:18\nWORKDIR /app' > "${projectPath}/configs/Dockerfile"`, {
        stdio: 'ignore',
      });
    });
  });

  describe('Database Schema Verification', () => {
    it('should have projects table with correct structure', () => {
      // Check database schema file
      const schemaPath = join(process.cwd(), 'packages/database/src/schema.ts');
      expect(existsSync(schemaPath)).toBe(true);

      const content = readFileSync(schemaPath, 'utf8');

      // Verify projects table exists
      expect(content).toContain('export const projects = sqliteTable');

      // Verify related tables exist for cascade deletion
      expect(content).toContain('export const deployments = sqliteTable');
      expect(content).toContain('export const configSets = sqliteTable');
      expect(content).toContain('export const analysisRuns = sqliteTable');
    });
  });

  describe('API Implementation Verification', () => {
    it('should have delete procedure in projects router', () => {
      const routerPath = join(process.cwd(), 'apps/api/src/routes/projects.ts');
      expect(existsSync(routerPath)).toBe(true);

      const content = readFileSync(routerPath, 'utf8');

      // Verify delete procedure exists
      expect(content).toContain('delete: protectedProcedure');

      // Verify it uses IdSchema for input validation
      expect(content).toContain('IdSchema');

      // Verify it has transaction support
      expect(content).toContain('db.transaction');

      // Verify it calls deleteProjectFiles
      expect(content).toContain('deleteProjectFiles');
    });
  });

  describe('Frontend Component Verification', () => {
    it('should have DeleteProjectDialog component', () => {
      const componentPath = join(process.cwd(), 'apps/web/components/projects/delete-dialog.tsx');
      expect(existsSync(componentPath)).toBe(true);

      const content = readFileSync(componentPath, 'utf8');

      // Verify component has required elements
      expect(content).toContain('DeleteProjectDialog');
      expect(content).toContain('Dialog');
      expect(content).toContain('Type the project name to confirm');
      expect(content).toContain('trpc.projects.delete');
    });

    it('should integrate delete dialog in dashboard', () => {
      const dashboardPath = join(process.cwd(), 'apps/web/app/dashboard/page.tsx');
      expect(existsSync(dashboardPath)).toBe(true);

      const content = readFileSync(dashboardPath, 'utf8');

      // Verify dialog is imported and used (handles both single-line and multi-line imports)
      expect(content).toMatch(/import\s+{[^}]*DeleteProjectDialog[^}]*}\s+from/);
      expect(content).toContain('DeleteProjectDialog');
      expect(content).toContain('handleDeleteClick');
    });
  });

  describe('Security Considerations', () => {
    it('should require user authentication', () => {
      const routerPath = join(process.cwd(), 'apps/api/src/routes/projects.ts');
      const content = readFileSync(routerPath, 'utf8');

      // Verify procedure is protected
      expect(content).toContain('protectedProcedure');

      // Verify user ownership check
      expect(content).toContain('userId');
      expect(content).toContain('eq(schema.projects.userId, userId)');
    });

    it('should validate input with Zod schema', () => {
      const routerPath = join(process.cwd(), 'apps/api/src/routes/projects.ts');
      const content = readFileSync(routerPath, 'utf8');

      // Verify input validation
      expect(content).toContain('IdSchema');
      expect(content).toContain('z.string()');
    });
  });

  describe('Error Handling', () => {
    it('should have proper error handling in delete procedure', () => {
      const routerPath = join(process.cwd(), 'apps/api/src/routes/projects.ts');
      const content = readFileSync(routerPath, 'utf8');

      // Verify try-catch blocks
      expect(content).toContain('try {');
      expect(content).toContain('catch (error)');

      // Verify error messages
      expect(content).toContain('Project not found or access denied');
      expect(content).toContain('Failed to delete project');
    });
  });
});
