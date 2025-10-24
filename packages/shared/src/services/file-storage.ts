import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * Get DXLander home directory
 * Default: ~/.dxlander/
 * Override with DXLANDER_HOME environment variable
 */
export function getDXLanderHome(): string {
  if (process.env.DXLANDER_HOME) {
    return process.env.DXLANDER_HOME
  }
  return path.join(os.homedir(), '.dxlander')
}

/**
 * Get projects directory
 * Default: ~/.dxlander/projects/
 */
export function getProjectsDir(): string {
  return path.join(getDXLanderHome(), 'projects')
}

/**
 * Get project directory by ID
 * Structure: ~/.dxlander/projects/{projectId}/
 */
export function getProjectDir(projectId: string): string {
  return path.join(getProjectsDir(), projectId)
}

/**
 * Get project files directory (where imported source code lives)
 * Structure: ~/.dxlander/projects/{projectId}/files/
 */
export function getProjectFilesDir(projectId: string): string {
  return path.join(getProjectDir(projectId), 'files')
}

/**
 * Get project configs directory (where generated configs live)
 * Structure: ~/.dxlander/projects/{projectId}/configs/
 */
export function getProjectConfigsDir(projectId: string): string {
  return path.join(getProjectDir(projectId), 'configs')
}

/**
 * Get specific config directory
 * Structure: ~/.dxlander/projects/{projectId}/configs/{configId}/
 */
export function getConfigDir(projectId: string, configId: string): string {
  return path.join(getProjectConfigsDir(projectId), configId)
}

/**
 * Ensure directory exists, create if not
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Write file to disk
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath)
  ensureDir(dir)
  fs.writeFileSync(filePath, content, 'utf-8')
}

/**
 * Delete directory recursively
 */
export function deleteDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}

/**
 * Get directory size in bytes
 */
export function getDirSize(dirPath: string): number {
  let totalSize = 0

  function calculateSize(currentPath: string) {
    const stats = fs.statSync(currentPath)

    if (stats.isFile()) {
      totalSize += stats.size
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath)
      files.forEach(file => {
        calculateSize(path.join(currentPath, file))
      })
    }
  }

  if (fs.existsSync(dirPath)) {
    calculateSize(dirPath)
  }

  return totalSize
}

/**
 * Count files in directory
 */
export function countFiles(dirPath: string): number {
  let fileCount = 0

  function count(currentPath: string) {
    const stats = fs.statSync(currentPath)

    if (stats.isFile()) {
      fileCount++
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath)
      files.forEach(file => {
        count(path.join(currentPath, file))
      })
    }
  }

  if (fs.existsSync(dirPath)) {
    count(dirPath)
  }

  return fileCount
}

/**
 * Save project files to disk
 * Returns: { filesCount, totalSize, localPath }
 */
export interface SaveProjectResult {
  filesCount: number
  totalSize: number
  localPath: string
}

export function saveProjectFiles(
  projectId: string,
  files: Map<string, string>
): SaveProjectResult {
  const projectDir = getProjectDir(projectId)

  // Ensure project directory exists
  ensureDir(projectDir)

  // Write all files
  let filesWritten = 0
  for (const [filePath, content] of files.entries()) {
    const fullPath = path.join(projectDir, filePath)
    writeFile(fullPath, content)
    filesWritten++
  }

  // Calculate total size
  const totalSize = getDirSize(projectDir)

  return {
    filesCount: filesWritten,
    totalSize,
    localPath: projectDir
  }
}

/**
 * Delete project files
 */
export function deleteProjectFiles(projectId: string): void {
  const projectDir = getProjectDir(projectId)
  deleteDir(projectDir)
}
