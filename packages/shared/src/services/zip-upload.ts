import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import {
  getProjectFilesDir,
  getProjectDir,
  ensureDir,
  getDirSize,
  countFiles,
} from './file-storage';

/**
 * Extract all files from uploaded ZIP
 *
 * IMPORTANT: Files are extracted to ~/.dxlander/projects/{projectId}/files/
 * This ensures separation from configs directory.
 */
export interface ExtractZipResult {
  files: Map<string, string>;
  filesCount: number;
  totalSize: number;
  /** Path to project root directory (not files directory) */
  localPath: string;
}

export async function extractZipFile(
  zipBuffer: Buffer,
  projectId: string
): Promise<ExtractZipResult> {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();

  const files = new Map<string, string>();

  // Get project paths
  const projectRoot = getProjectDir(projectId);
  const projectFilesDir = getProjectFilesDir(projectId);

  // Ensure both directories exist
  ensureDir(projectRoot);
  ensureDir(projectFilesDir);

  for (const entry of zipEntries) {
    // Skip directories
    if (entry.isDirectory) {
      continue;
    }

    try {
      // Extract file content
      const content = entry.getData().toString('utf-8');
      const entryPath = entry.entryName;

      // Remove root directory from path if present (common in zip files)
      let normalizedPath = entryPath;
      const pathParts = entryPath.split('/');
      if (pathParts.length > 1 && !pathParts[0].includes('.')) {
        normalizedPath = pathParts.slice(1).join('/');
      }

      // Save to files map
      files.set(normalizedPath, content);

      // Write to disk in files directory
      const fullPath = path.join(projectFilesDir, normalizedPath);
      const dir = path.dirname(fullPath);
      ensureDir(dir);
      fs.writeFileSync(fullPath, content, 'utf-8');
    } catch (error) {
      // Skip files that can't be read as text (binary files)
      console.log(`Skipping binary file: ${entry.entryName}`);
    }
  }

  // Get metadata
  const filesCount = countFiles(projectFilesDir);
  const totalSize = getDirSize(projectFilesDir);

  return {
    files,
    filesCount,
    totalSize,
    localPath: projectRoot, // Return project root, not files dir
  };
}

/**
 * Validate ZIP file
 */
export interface ZipValidationResult {
  valid: boolean;
  error?: string;
  size?: number;
}

export function validateZipFile(
  buffer: Buffer,
  maxSize: number = 500 * 1024 * 1024 // 500MB default
): ZipValidationResult {
  // Check file size
  if (buffer.length > maxSize) {
    return {
      valid: false,
      error: `ZIP file too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
    };
  }

  // Try to open zip
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      return {
        valid: false,
        error: 'ZIP file is empty',
      };
    }

    return {
      valid: true,
      size: buffer.length,
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid ZIP file format',
    };
  }
}
