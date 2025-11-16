/**
 * Tool Implementations
 *
 * Actual implementations of tools that AI providers can use to explore projects.
 * These are the "hands" of the AI - allowing it to read files, search code, etc.
 */

import { isPathSafe } from '../../file-storage';

/**
 * Tool context provided to each tool execution
 */
export interface ToolContext {
  projectPath: string; // Absolute path to project root
}

/**
 * Read a file from the project
 */
export async function readFileImpl(
  { filePath }: { filePath: string },
  context: ToolContext
): Promise<{ filePath: string; content: string; size: number; lines: number }> {
  const fs = await import('fs/promises');
  const path = await import('path');

  // Security: Validate path is within project
  if (!isPathSafe(context.projectPath, filePath)) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  const fullPath = path.join(context.projectPath, filePath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n').length;

    return {
      filePath,
      content,
      size: content.length,
      lines,
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    } else if (error.code === 'EISDIR') {
      throw new Error(`Path is a directory, not a file: ${filePath}`);
    } else {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }
}

/**
 * Search for text patterns in project files using grep
 */
export async function grepSearchImpl(
  {
    pattern,
    glob,
    caseSensitive = true,
  }: {
    pattern: string;
    glob?: string;
    caseSensitive?: boolean;
  },
  context: ToolContext
): Promise<{
  pattern: string;
  matches: Array<{ file: string; line: string; lineNumber: number }>;
  count: number;
}> {
  const { execSync } = await import('child_process');

  try {
    // Build ripgrep command
    const flags: string[] = [];

    if (!caseSensitive) {
      flags.push('-i');
    }

    // Add line numbers
    flags.push('-n');

    // Add glob filter if provided
    if (glob) {
      flags.push(`--glob "${glob}"`);
    }

    // Use ripgrep (rg) if available, fallback to grep
    const command = `rg ${flags.join(' ')} "${pattern.replace(/"/g, '\\"')}" "${context.projectPath}"`;

    const result = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB max
      stdio: ['pipe', 'pipe', 'pipe'], // Capture stderr separately
    });

    // Parse rg output: "file:lineNumber:line content"
    const matches = result
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (!match) {
          return null;
        }

        const [, file, lineNumberStr, content] = match;
        return {
          file: file.replace(`${context.projectPath}/`, ''), // Make path relative
          line: content,
          lineNumber: parseInt(lineNumberStr, 10),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    return {
      pattern,
      matches,
      count: matches.length,
    };
  } catch (error: any) {
    // ripgrep returns exit code 1 if no matches found (not an error)
    if (error.status === 1) {
      return {
        pattern,
        matches: [],
        count: 0,
      };
    }

    // Check if ripgrep is not installed
    if (error.message?.includes('command not found') || error.message?.includes('rg')) {
      throw new Error(
        'ripgrep (rg) is not installed. Please install ripgrep or use a different search method.'
      );
    }

    throw new Error(`Grep search failed: ${error.message}`);
  }
}

/**
 * Find files matching a glob pattern
 */
export async function globFindImpl(
  { pattern }: { pattern: string },
  context: ToolContext
): Promise<{ pattern: string; files: string[]; count: number }> {
  const glob = await import('fast-glob');

  try {
    const files = await glob.default(pattern, {
      cwd: context.projectPath,
      dot: false, // Don't include hidden files by default
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'], // Common ignore patterns
    });

    return {
      pattern,
      files: files.sort(),
      count: files.length,
    };
  } catch (error: any) {
    throw new Error(`Glob search failed for pattern "${pattern}": ${error.message}`);
  }
}

/**
 * List contents of a directory
 */
export async function listDirectoryImpl(
  { dirPath = '.' }: { dirPath?: string },
  context: ToolContext
): Promise<{ path: string; files: string[]; directories: string[]; totalItems: number }> {
  const fs = await import('fs/promises');
  const path = await import('path');

  // Security: Validate path is within project
  if (!isPathSafe(context.projectPath, dirPath)) {
    throw new Error(`Path traversal detected: ${dirPath}`);
  }

  const fullPath = path.join(context.projectPath, dirPath);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    const directories = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    return {
      path: dirPath,
      files: files.sort(),
      directories: directories.sort(),
      totalItems: entries.length,
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Directory not found: ${dirPath}`);
    } else if (error.code === 'ENOTDIR') {
      throw new Error(`Path is not a directory: ${dirPath}`);
    } else {
      throw new Error(`Failed to list directory ${dirPath}: ${error.message}`);
    }
  }
}
