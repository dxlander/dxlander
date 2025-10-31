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

/**
 * Get specific config directory
 * Structure: ~/.dxlander/projects/{projectId}/configs/{configId}/
 */
export function getConfigDir(projectId: string, configId: string): string {
  return path.join(getProjectConfigsDir(projectId), configId);
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
    localPath: projectRoot, // Return project root, not files dir
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
    localPath: projectRoot, // Return project root, not files dir
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
 * Validate that a path is within the project files directory
 * Prevents accidental writes to configs or other directories
 *
 * @param projectId - Unique project identifier
 * @param targetPath - Path to validate
 * @returns true if path is valid for file operations
 */
export function isValidFilePath(projectId: string, targetPath: string): boolean {
  const filesDir = getProjectFilesDir(projectId);
  const normalizedTarget = path.normalize(targetPath);
  const normalizedFilesDir = path.normalize(filesDir);

  // Path must be inside the files directory
  return normalizedTarget.startsWith(normalizedFilesDir);
}

/**
 * Validate that a path is within the project configs directory
 * Prevents accidental writes to files or other directories
 *
 * @param projectId - Unique project identifier
 * @param targetPath - Path to validate
 * @returns true if path is valid for config operations
 */
export function isValidConfigPath(projectId: string, targetPath: string): boolean {
  const configsDir = getProjectConfigsDir(projectId);
  const normalizedTarget = path.normalize(targetPath);
  const normalizedConfigsDir = path.normalize(configsDir);

  // Path must be inside the configs directory
  return normalizedTarget.startsWith(normalizedConfigsDir);
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
