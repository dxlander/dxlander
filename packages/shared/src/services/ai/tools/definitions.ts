/**
 * Tool Definitions for Vercel AI SDK
 *
 * These tools give AI providers the ability to explore projects autonomously:
 * - Read files (package.json, source code, configs)
 * - Search code (find API calls, imports, environment variables)
 * - Find files (discover all TypeScript files, config files, etc.)
 * - List directories (understand project structure)
 *
 * All providers (Groq, OpenRouter, OpenAI, etc.) will use these same tools,
 * ensuring consistent analysis quality across all AI models.
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  readFileImpl,
  grepSearchImpl,
  globFindImpl,
  listDirectoryImpl,
  type ToolContext,
} from './implementations';

/**
 * Project Analysis Tools
 *
 * These tools are provided to AI models during project analysis.
 * The AI decides when and how to use each tool based on what it needs to learn.
 */
export function createProjectAnalysisTools(context: ToolContext) {
  return {
    /**
     * Read a file from the project
     *
     * Use this to examine:
     * - Package manifests (package.json, requirements.txt, Cargo.toml)
     * - Configuration files (tsconfig.json, next.config.js, etc.)
     * - Source code files (to understand framework usage, API calls)
     * - Documentation (README.md, CHANGELOG.md)
     * - Environment examples (.env.example)
     */
    readFile: tool({
      description: `Read a file from the project directory. Use this to examine source code, configuration files, package manifests, README files, environment variable examples, etc. Returns the file content, size, and line count.`,
      inputSchema: z.object({
        filePath: z
          .string()
          .describe(
            'Relative path to the file from project root (e.g., "package.json", "src/index.ts", ".env.example")'
          ),
      }),
      execute: async ({ filePath }) => readFileImpl({ filePath }, context),
    }),

    /**
     * Search for text patterns in project files
     *
     * Use this to find:
     * - Imports and requires (e.g., "import.*supabase")
     * - API keys and environment variables (e.g., "SUPABASE_URL", "API_KEY")
     * - Framework-specific patterns (e.g., "useEffect", "app.get(")
     * - Database queries (e.g., "SELECT.*FROM", "db.collection")
     * - External service usage (e.g., "stripe", "sendgrid")
     */
    grepSearch: tool({
      description: `Search for text patterns in project files using regex. Use this to find specific code patterns, imports, API calls, environment variables, database queries, etc. Returns matching lines with file paths and line numbers.`,
      inputSchema: z.object({
        pattern: z
          .string()
          .describe(
            'Regex pattern to search for (e.g., "import.*React", "SUPABASE_", "app\\.get\\(")'
          ),
        glob: z
          .string()
          .optional()
          .describe(
            'Optional glob pattern to filter files (e.g., "*.ts" for TypeScript files, "**/*.js" for all JS files)'
          ),
        caseSensitive: z
          .boolean()
          .default(true)
          .describe('Whether the search should be case-sensitive (default: true)'),
      }),
      execute: async ({ pattern, glob, caseSensitive }) =>
        grepSearchImpl({ pattern, glob, caseSensitive }, context),
    }),

    /**
     * Find files matching a glob pattern
     *
     * Use this to discover:
     * - All source files (e.g., glob all TypeScript files, Python files, Go files)
     * - Configuration files (e.g., tsconfig.json, .env.example files)
     * - Package manifests (e.g., package.json, requirements.txt files)
     * - Test files (e.g., test files, spec files)
     * - Documentation files (e.g., markdown files)
     */
    globFind: tool({
      description: `Find files matching a glob pattern. Use this to discover files by name or extension (e.g., all TypeScript files, all config files, all package.json files). Returns a sorted list of matching file paths.`,
      inputSchema: z.object({
        pattern: z
          .string()
          .describe(
            'Glob pattern to match files (e.g., glob pattern for all TypeScript files, package.json files, or React components in src/)'
          ),
      }),
      execute: async ({ pattern }) => globFindImpl({ pattern }, context),
    }),

    /**
     * List contents of a directory
     *
     * Use this to:
     * - Understand project structure (what's in the root directory?)
     * - Find entry points (e.g., list src/ to find main.ts)
     * - Discover configuration files (e.g., list root to find config files)
     * - Explore subdirectories (e.g., list components/ to see component files)
     */
    listDirectory: tool({
      description: `List files and subdirectories in a directory. Use this to understand project structure, find entry points, or discover configuration files. Returns separate lists of files and directories, sorted alphabetically.`,
      inputSchema: z.object({
        dirPath: z
          .string()
          .default('.')
          .describe(
            'Relative directory path from project root (default: "." for root directory, e.g., "src", "components", "config")'
          ),
      }),
      execute: async ({ dirPath }) => listDirectoryImpl({ dirPath }, context),
    }),
  };
}

/**
 * Deployment Config Generation Tools
 *
 * These tools are used when generating deployment configurations.
 * Currently, we only provide Write tool (handled separately in BaseToolProvider).
 */
export function createConfigGenerationTools(_context: ToolContext) {
  return {
    // Future: Add Write tool here when we migrate config generation to tool-calling
    // For now, we'll keep the Claude Agent SDK's Write tool for config generation
  };
}
