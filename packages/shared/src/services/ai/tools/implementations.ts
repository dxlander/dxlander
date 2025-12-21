/**
 * Tool Implementations
 *
 * Actual implementations of tools that AI providers can use to explore projects.
 * These are the "hands" of the AI - allowing it to read files, search code, etc.
 */

import path from 'path';
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
  const pathModule = await import('path');

  // Security: Validate path is within project
  if (!isPathSafe(context.projectPath, filePath)) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  const fullPath = pathModule.join(context.projectPath, filePath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    // Handle line counting: empty file = 0 lines, account for trailing newlines
    const lines =
      content === '' ? 0 : content.split('\n').length - (content.endsWith('\n') ? 1 : 0);

    return {
      filePath,
      content,
      size: Buffer.byteLength(content, 'utf-8'),
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
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    // Build ripgrep arguments
    const args: string[] = [];

    if (!caseSensitive) {
      args.push('-i');
    }

    // Add line numbers
    args.push('-n');

    // Add glob filter if provided
    if (glob) {
      args.push('--glob', glob);
    }

    // Add pattern and search path
    args.push(pattern, context.projectPath);

    const { stdout } = await execFileAsync('rg', args, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB max
    });

    // Parse rg output: "file:lineNumber:line content"
    const matches = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (!match) {
          return null;
        }

        const [, file, lineNumberStr, content] = match;
        return {
          file: path.relative(context.projectPath, file), // Make path relative
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
    if (error.code === 1) {
      return {
        pattern,
        matches: [],
        count: 0,
      };
    }

    // Check if ripgrep is not installed (ENOENT = command not found)
    if (error.code === 'ENOENT') {
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
  const pathModule = await import('path');

  try {
    const rawFiles = await glob.default(pattern, {
      cwd: context.projectPath,
      dot: false, // Don't include hidden files by default
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'], // Common ignore patterns
    });

    const safeFiles = rawFiles.filter((file) => {
      const absolutePath = pathModule.resolve(context.projectPath, file);
      return isPathSafe(context.projectPath, absolutePath);
    });

    const sortedFiles = safeFiles.sort();

    return {
      pattern,
      files: sortedFiles,
      count: sortedFiles.length,
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
  const pathModule = await import('path');

  // Security: Validate path is within project
  if (!isPathSafe(context.projectPath, dirPath)) {
    throw new Error(`Path traversal detected: ${dirPath}`);
  }

  const fullPath = pathModule.join(context.projectPath, dirPath);

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

/**
 * Write a file to the project (used for config generation)
 */
export async function writeFileImpl(
  { filePath, content }: { filePath: string; content: string },
  context: ToolContext
): Promise<{ filePath: string; size: number; success: boolean }> {
  const fs = await import('fs/promises');
  const pathModule = await import('path');

  // Security: Validate path is within project
  if (!isPathSafe(context.projectPath, filePath)) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  const fullPath = pathModule.join(context.projectPath, filePath);

  try {
    // Ensure parent directory exists
    const parentDir = pathModule.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
    const size = Buffer.byteLength(content, 'utf-8');

    console.log(`  📝 Wrote file: ${filePath} (${size} bytes)`);

    return {
      filePath,
      size,
      success: true,
    };
  } catch (error: any) {
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}
