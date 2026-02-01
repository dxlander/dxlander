import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Get DXLander home directory
 * Default: ~/.dxlander/
 * Override with DXLANDER_HOME environment variable
 */
export function getDXLanderHome(): string {
  if (process.env.DXLANDER_HOME) {
    return process.env.DXLANDER_HOME;
  }
  return path.join(os.homedir(), '.dxlander');
}

/**
 * Get projects directory
 * Default: ~/.dxlander/projects/
 */
export function getProjectsDir(): string {
  return path.join(getDXLanderHome(), 'projects');
}

/**
 * Get project directory by ID
 * Structure: ~/.dxlander/projects/{projectId}/
 */
export function getProjectDir(projectId: string): string {
  return path.join(getProjectsDir(), projectId);
}

/**
 * Get project files directory (where imported source code lives)
 * Structure: ~/.dxlander/projects/{projectId}/files/
 */
export function getProjectFilesDir(projectId: string): string {
  return path.join(getProjectDir(projectId), 'files');
}

/**
 * Get project configs directory (where generated configs live)
 * Structure: ~/.dxlander/projects/{projectId}/configs/
 */
export function getProjectConfigsDir(projectId: string): string {
  return path.join(getProjectDir(projectId), 'configs');
}

export function getConfigDir(projectId: string, configId: string): string {
  return path.join(getProjectConfigsDir(projectId), configId);
}

/**
 * Convert absolute path to relative path from DXLANDER_HOME
 * Example: /home/user/.dxlander/projects/abc123 -> projects/abc123
 * This enables portable storage that works when .dxlander folder is moved
 */
export function getRelativeProjectPath(absolutePath: string): string {
  const dxlanderHome = getDXLanderHome();
  const resolvedPath = path.resolve(absolutePath);
  const resolvedHome = path.resolve(dxlanderHome);

  // On Windows, drive letters can differ in case (C: vs c:) but represent the same path
  // Use case-insensitive comparison on Windows
  const isWindows = process.platform === 'win32';
  const normalizedPath = isWindows ? resolvedPath.toLowerCase() : resolvedPath;
  const normalizedHome = isWindows ? resolvedHome.toLowerCase() : resolvedHome;
  const homeWithSep = normalizedHome + path.sep;

  if (normalizedPath === normalizedHome || normalizedPath.startsWith(homeWithSep)) {
    return path.relative(resolvedHome, resolvedPath);
  }

  // Path is outside DXLANDER_HOME - this shouldn't happen in normal usage
  // Log warning and return as-is for backward compatibility
  console.warn(
    `[Path Warning] Path "${absolutePath}" is outside DXLANDER_HOME. ` +
      `This may cause portability issues. Ensure all project paths are within ${dxlanderHome}`
  );
  return absolutePath;
}

/**
 * Resolve relative (or absolute) path to absolute path based on DXLANDER_HOME
 * Example: projects/abc123 -> /home/user/.dxlander/projects/abc123
 * Handles both relative paths (new format) and absolute paths (legacy format)
 */
export function resolveProjectPath(pathStr: string | null | undefined): string | null {
  if (!pathStr) return null;

  // If already absolute, return as-is (backward compatibility)
  if (path.isAbsolute(pathStr)) {
    return pathStr;
  }

  // Resolve relative path against DXLANDER_HOME
  return path.join(getDXLanderHome(), pathStr);
}

/**
 * Validate that a target path is safely within a base directory.
 * Prevents path traversal attacks by using absolute path resolution.
 *
 * @param baseDir - The base directory that should contain the target
 * @param targetPath - The path to validate (relative or absolute)
 * @returns true if target is safely within baseDir, false otherwise
 */
export function isPathSafe(baseDir: string, targetPath: string): boolean {
  // Resolve both paths to absolute paths
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, targetPath);

  // Append path separator to base to prevent prefix false positives
  // E.g., /app vs /app-other
  const baseDirWithSep = resolvedBase + path.sep;

  // Check if target is strictly inside base directory or equals it
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(baseDirWithSep);
}

/**
 * Ensure directory exists, create if not
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write file to disk
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Delete directory recursively
 */
export function deleteDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Get directory size in bytes
 */
export function getDirSize(dirPath: string): number {
  let totalSize = 0;

  function calculateSize(currentPath: string) {
    const stats = fs.statSync(currentPath);

    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach((file) => {
        calculateSize(path.join(currentPath, file));
      });
    }
  }

  if (fs.existsSync(dirPath)) {
    calculateSize(dirPath);
  }

  return totalSize;
}

/**
 * Count files in directory
 */
export function countFiles(dirPath: string): number {
  let fileCount = 0;

  function count(currentPath: string) {
    const stats = fs.statSync(currentPath);

    if (stats.isFile()) {
      fileCount++;
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach((file) => {
        count(path.join(currentPath, file));
      });
    }
  }

  if (fs.existsSync(dirPath)) {
    count(dirPath);
  }

  return fileCount;
}

/**
 * Save project files to disk
 * Returns: { filesCount, totalSize, localPath }
 *
 * IMPORTANT: Files are saved to ~/.dxlander/projects/{projectId}/files/
 * This ensures separation from configs directory.
 */
export interface SaveProjectResult {
  filesCount: number;
  totalSize: number;
  /** Path to project root directory (not files directory) */
  localPath: string;
}

export function saveProjectFiles(projectId: string, files: Map<string, string>): SaveProjectResult {
  // Get project directories
  const projectRoot = getProjectDir(projectId);
  const filesDir = getProjectFilesDir(projectId);

  // Ensure both project root and files directory exist
  ensureDir(projectRoot);
  ensureDir(filesDir);

  // Write all files to the /files subdirectory with path validation
  let filesWritten = 0;
  for (const [filePath, content] of files.entries()) {
    // Security: Validate path to prevent traversal attacks
    if (!isPathSafe(filesDir, filePath)) {
      throw new Error(`Invalid file path: ${filePath} (path traversal detected)`);
    }

    const fullPath = path.join(filesDir, filePath);
    writeFile(fullPath, content);
    filesWritten++;
  }

  // Calculate total size of files directory
  const totalSize = getDirSize(filesDir);

  return {
    filesCount: filesWritten,
    totalSize,
    localPath: getRelativeProjectPath(projectRoot), // Return RELATIVE path for portability
  };
}

/**
 * Move a temporary extracted project into permanent storage and return file statistics.
 *
 * IMPORTANT: Files are moved to ~/.dxlander/projects/{projectId}/files/
 * This ensures separation from configs directory and consistency across all import sources.
 */
export function persistTempProjectDirectory(
  projectId: string,
  tempExtractPath: string
): SaveProjectResult {
  // Get project directories
  const projectRoot = getProjectDir(projectId);
  const filesDir = getProjectFilesDir(projectId);

  // Ensure both project root and files directory exist
  ensureDir(projectRoot);
  ensureDir(filesDir);

  // Copy extracted files to the /files subdirectory
  fs.cpSync(tempExtractPath, filesDir, { recursive: true, force: true });

  // Calculate stats from files directory
  const filesCount = countFiles(filesDir);
  const totalSize = getDirSize(filesDir);

  // Cleanup temp directory
  const tempRoot = path.dirname(tempExtractPath);
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch (error) {
    // Best effort cleanup, ignore failures.
    void error;
  }

  return {
    filesCount,
    totalSize,
    localPath: getRelativeProjectPath(projectRoot), // Return RELATIVE path for portability
  };
}

/**
 * Delete project files
 */
export function deleteProjectFiles(projectId: string): void {
  const projectDir = getProjectDir(projectId);
  deleteDir(projectDir);
}

/**
 * SECURITY: Validate that a path is within the project files directory
 * Prevents path traversal attacks and accidental writes to configs or other directories
 *
 * @param projectId - Unique project identifier
 * @param targetPath - Path to validate (can be relative or absolute)
 * @returns true if path is safely inside the files directory
 */
export function isValidFilePath(projectId: string, targetPath: string): boolean {
  const filesDir = getProjectFilesDir(projectId);

  // Use secure path validation to prevent directory traversal
  return isPathSafe(filesDir, targetPath);
}

/**
 * SECURITY: Validate that a path is within the project configs directory
 * Prevents path traversal attacks and accidental writes to files or other directories
 *
 * @param projectId - Unique project identifier
 * @param targetPath - Path to validate (can be relative or absolute)
 * @returns true if path is safely inside the configs directory
 */
export function isValidConfigPath(projectId: string, targetPath: string): boolean {
  const configsDir = getProjectConfigsDir(projectId);

  // Use secure path validation to prevent directory traversal
  return isPathSafe(configsDir, targetPath);
}

/**
 * Initialize project directory structure
 * Creates: {projectId}/, {projectId}/files/, {projectId}/configs/
 *
 * @param projectId - Unique project identifier
 */
export function initializeProjectStructure(projectId: string): void {
  const projectRoot = getProjectDir(projectId);
  const filesDir = getProjectFilesDir(projectId);
  const configsDir = getProjectConfigsDir(projectId);

  ensureDir(projectRoot);
  ensureDir(filesDir);
  ensureDir(configsDir);
}
