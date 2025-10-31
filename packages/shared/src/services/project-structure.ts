/**
 * Project Structure Manager
 *
 * Centralized service for managing DXLander project directory structure.
 * Ensures 100% consistency across all import sources (GitHub, GitLab, Bitbucket, ZIP).
 *
 * Standard Structure:
 * ~/.dxlander/projects/{projectId}/
 *   ├── files/           ← Source code imported from any source
 *   └── configs/         ← Generated deployment configurations
 *       ├── {configId}/  ← Individual config set
 *       └── {configId}/  ← Another config set
 *
 * This structure is enforced for ALL import types to prevent:
 * - Configs being created inside source files
 * - Source files polluting config directories
 * - Inconsistent paths across different import sources
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getProjectDir,
  getProjectFilesDir,
  getProjectConfigsDir,
  ensureDir,
  getDirSize,
  countFiles,
} from './file-storage';

/**
 * Project structure paths for a specific project
 */
export interface ProjectPaths {
  /** Root project directory: ~/.dxlander/projects/{projectId}/ */
  projectRoot: string;
  /** Source files directory: ~/.dxlander/projects/{projectId}/files/ */
  filesDir: string;
  /** Configs directory: ~/.dxlander/projects/{projectId}/configs/ */
  configsDir: string;
}

/**
 * Result of project initialization
 */
export interface ProjectInitResult {
  projectId: string;
  paths: ProjectPaths;
  created: boolean;
}

/**
 * Project Structure Manager
 *
 * Provides centralized, type-safe access to project directory structure.
 * Use this service for ALL project directory operations.
 */
export class ProjectStructureManager {
  /**
   * Initialize project directory structure
   *
   * Creates the standard directory layout:
   * - {projectId}/
   * - {projectId}/files/
   * - {projectId}/configs/
   *
   * This MUST be called before saving any project files.
   *
   * @param projectId - Unique project identifier
   * @returns Project paths and creation status
   */
  static initializeProjectStructure(projectId: string): ProjectInitResult {
    const paths = this.getProjectPaths(projectId);

    // Create all required directories
    ensureDir(paths.projectRoot);
    ensureDir(paths.filesDir);
    ensureDir(paths.configsDir);

    return {
      projectId,
      paths,
      created: true,
    };
  }

  /**
   * Get all paths for a project
   *
   * @param projectId - Unique project identifier
   * @returns Object containing all project paths
   */
  static getProjectPaths(projectId: string): ProjectPaths {
    return {
      projectRoot: getProjectDir(projectId),
      filesDir: getProjectFilesDir(projectId),
      configsDir: getProjectConfigsDir(projectId),
    };
  }

  /**
   * Validate that a path is within the files directory
   *
   * Prevents accidental writes to configs or other directories
   *
   * @param projectId - Unique project identifier
   * @param targetPath - Path to validate
   * @returns true if path is valid for file operations
   */
  static isValidFilePath(projectId: string, targetPath: string): boolean {
    const paths = this.getProjectPaths(projectId);
    const normalizedTarget = path.normalize(targetPath);
    const normalizedFilesDir = path.normalize(paths.filesDir);

    // Path must be inside the files directory
    return normalizedTarget.startsWith(normalizedFilesDir);
  }

  /**
   * Validate that a path is within the configs directory
   *
   * Prevents accidental writes to files or other directories
   *
   * @param projectId - Unique project identifier
   * @param targetPath - Path to validate
   * @returns true if path is valid for config operations
   */
  static isValidConfigPath(projectId: string, targetPath: string): boolean {
    const paths = this.getProjectPaths(projectId);
    const normalizedTarget = path.normalize(targetPath);
    const normalizedConfigsDir = path.normalize(paths.configsDir);

    // Path must be inside the configs directory
    return normalizedTarget.startsWith(normalizedConfigsDir);
  }

  /**
   * Get project statistics
   *
   * @param projectId - Unique project identifier
   * @returns Statistics about project files and configs
   */
  static getProjectStats(projectId: string): {
    filesCount: number;
    totalSize: number;
    configsCount: number;
  } {
    const paths = this.getProjectPaths(projectId);

    const filesCount = countFiles(paths.filesDir);
    const totalSize = getDirSize(paths.filesDir);

    // Count config directories (each subdirectory is a config set)
    let configsCount = 0;
    if (fs.existsSync(paths.configsDir)) {
      const configDirs = fs.readdirSync(paths.configsDir, { withFileTypes: true });
      configsCount = configDirs.filter((dirent) => dirent.isDirectory()).length;
    }

    return {
      filesCount,
      totalSize,
      configsCount,
    };
  }

  /**
   * Clean up project directory
   *
   * Removes all files and configs for a project
   *
   * @param projectId - Unique project identifier
   */
  static cleanupProject(projectId: string): void {
    const paths = this.getProjectPaths(projectId);

    if (fs.existsSync(paths.projectRoot)) {
      fs.rmSync(paths.projectRoot, { recursive: true, force: true });
    }
  }

  /**
   * Verify project structure integrity
   *
   * Checks that all required directories exist
   *
   * @param projectId - Unique project identifier
   * @returns true if structure is valid
   */
  static verifyStructure(projectId: string): boolean {
    const paths = this.getProjectPaths(projectId);

    return (
      fs.existsSync(paths.projectRoot) &&
      fs.existsSync(paths.filesDir) &&
      fs.existsSync(paths.configsDir)
    );
  }

  /**
   * Repair project structure if corrupted
   *
   * Re-creates missing directories
   *
   * @param projectId - Unique project identifier
   */
  static repairStructure(projectId: string): void {
    const paths = this.getProjectPaths(projectId);

    ensureDir(paths.projectRoot);
    ensureDir(paths.filesDir);
    ensureDir(paths.configsDir);
  }
}
