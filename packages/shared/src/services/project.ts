import { createHash } from 'crypto';
import { GitLabService, type GitLabConfig, type GitLabRepoInfo } from './gitlab';
import { BitbucketService, type BitbucketConfig, type BitbucketRepoInfo } from './bitbucket';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { ReadEntry } from 'tar';

export interface ProjectAnalysisInput {
  projectId: string;
  files: Map<string, string>;
  repoInfo?: {
    owner: string;
    repo: string;
    branch: string;
    language?: string;
    description?: string;
    topics?: string[];
  };
}

/**
 * Generate a unique hash for project source
 * Used for duplicate detection
 */
export function generateSourceHash(sourceUrl: string, branch?: string): string {
  const input = `${sourceUrl}:${branch || 'default'}`;
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Validate project name (optional - will generate random name if not provided)
 */
export function validateProjectName(name?: string): { valid: boolean; error?: string } {
  // Name is optional - will be generated if not provided
  if (!name || name.trim().length === 0) {
    return { valid: true };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Project name must be less than 100 characters' };
  }

  // Allow alphanumeric, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return {
      valid: false,
      error: 'Project name can only contain letters, numbers, spaces, hyphens, and underscores',
    };
  }

  return { valid: true };
}

/**
 * Generate a random project name like hosting platforms do
 * Format: adjective-noun-number (e.g., uncanny-john-23545)
 */
export function generateRandomProjectName(): string {
  const adjectives = [
    'autumn',
    'hidden',
    'bitter',
    'misty',
    'silent',
    'empty',
    'dry',
    'dark',
    'summer',
    'icy',
    'delicate',
    'quiet',
    'white',
    'cool',
    'spring',
    'winter',
    'patient',
    'twilight',
    'dawn',
    'crimson',
    'wispy',
    'weathered',
    'blue',
    'billowing',
    'broken',
    'cold',
    'damp',
    'falling',
    'frosty',
    'green',
    'long',
    'late',
    'lingering',
    'bold',
    'little',
    'morning',
    'muddy',
    'old',
    'red',
    'rough',
    'still',
    'small',
    'sparkling',
    'throbbing',
    'shy',
    'wandering',
    'withered',
    'wild',
    'black',
    'young',
    'holy',
    'solitary',
    'fragrant',
    'aged',
    'snowy',
    'proud',
    'floral',
    'restless',
    'divine',
    'polished',
    'ancient',
    'purple',
    'lively',
    'nameless',
    'lucky',
    'odd',
    'untamed',
    'tender',
    'shiny',
    'fancy',
    'swift',
    'rapid',
    'uncanny',
  ];

  const nouns = [
    'waterfall',
    'river',
    'breeze',
    'moon',
    'rain',
    'wind',
    'sea',
    'morning',
    'snow',
    'lake',
    'sunset',
    'pine',
    'shadow',
    'leaf',
    'dawn',
    'glitter',
    'forest',
    'hill',
    'cloud',
    'meadow',
    'sun',
    'glade',
    'bird',
    'brook',
    'butterfly',
    'bush',
    'dew',
    'dust',
    'field',
    'fire',
    'flower',
    'firefly',
    'feather',
    'grass',
    'haze',
    'mountain',
    'night',
    'pond',
    'darkness',
    'snowflake',
    'silence',
    'sound',
    'sky',
    'shape',
    'surf',
    'thunder',
    'violet',
    'water',
    'wildflower',
    'wave',
    'water',
    'resonance',
    'sun',
    'wood',
    'dream',
    'cherry',
    'tree',
    'fog',
    'frost',
    'voice',
    'paper',
    'frog',
    'smoke',
    'star',
    'john',
    'mary',
    'peter',
    'paul',
    'susan',
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(10000 + Math.random() * 90000); // 5-digit number

  return `${adjective}-${noun}-${number}`;
}

export async function importFromGitLab(
  config: GitLabConfig,
  projectId: string,
  branch?: string
): Promise<{ extractPath: string; branch: string; repoInfo: GitLabRepoInfo }> {
  const gitlabService = new GitLabService(config);

  // Validate token
  const isValid = await gitlabService.validateToken();
  if (!isValid) {
    throw new Error('Invalid GitLab token');
  }

  // Get repository info
  const repoInfo = await gitlabService.getRepository(projectId);
  const targetBranch = branch || repoInfo.defaultBranch;

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `gitlab-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Download repository
    const archivePath = await gitlabService.downloadRepository(projectId, targetBranch, tempDir);

    // Security: Validate archive size to prevent zip bombs
    const archiveStats = fs.statSync(archivePath);
    const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024; // 500MB
    if (archiveStats.size > MAX_ARCHIVE_SIZE) {
      throw new Error(
        `Archive too large (${(archiveStats.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed: 500MB`
      );
    }

    // Extract archive
    const extractPath = path.join(tempDir, 'extracted');
    fs.mkdirSync(extractPath, { recursive: true });

    // Use tar to extract with security filters
    const tar = await import('tar');
    let fileCount = 0;
    const MAX_FILES = 10000;

    await tar.x({
      file: archivePath,
      cwd: extractPath,
      strip: 1,
      preservePaths: false,
      strict: true,
      filter: (tarPath: string, entry: ReadEntry | fs.Stats) => {
        // Security: Limit file count to prevent resource exhaustion
        fileCount++;
        if (fileCount > MAX_FILES) {
          throw new Error(`Archive contains too many files (>${MAX_FILES})`);
        }

        if (!entry || typeof entry !== 'object') {
          console.warn(`[Security] Missing archive entry metadata for: ${tarPath}`);
          return false;
        }

        const entryType =
          'type' in entry && typeof entry.type === 'string' ? entry.type : undefined;
        if (entryType !== 'File' && entryType !== 'Directory') {
          return false;
        }

        const candidatePathRaw =
          'path' in entry && typeof entry.path === 'string' ? entry.path : tarPath;
        const candidatePath = typeof candidatePathRaw === 'string' ? candidatePathRaw : '';

        if (candidatePath) {
          if (path.isAbsolute(candidatePath)) {
            console.warn(`[Security] Blocked absolute path in archive: ${candidatePath}`);
            return false;
          }

          const normalized = candidatePath.replace(/\\/g, '/');
          const segments = normalized.split('/').filter(Boolean);
          if (segments.includes('..')) {
            console.warn(`[Security] Blocked path traversal in archive: ${candidatePath}`);
            return false;
          }
        }

        return true;
      },
    });

    // Cleanup archive to avoid disk space leaks
    try {
      fs.unlinkSync(archivePath);
    } catch (err) {
      // Best-effort cleanup; ignore errors
      void err;
    }

    return { extractPath, branch: targetBranch, repoInfo };
  } catch (error) {
    // Cleanup on error
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export async function importFromBitbucket(
  config: BitbucketConfig,
  workspace: string,
  repoSlug: string,
  branch?: string
): Promise<{ extractPath: string; branch: string; repoInfo: BitbucketRepoInfo }> {
  const bitbucketService = new BitbucketService(config);

  // Validate credentials
  const isValid = await bitbucketService.validateCredentials();
  if (!isValid) {
    throw new Error('Invalid Bitbucket credentials');
  }

  // Get repository info
  const repoInfo = await bitbucketService.getRepository(workspace, repoSlug);
  const targetBranch = branch || repoInfo.mainBranch;

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `bitbucket-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Download repository
    const archivePath = await bitbucketService.downloadRepository(
      workspace,
      repoSlug,
      targetBranch,
      tempDir
    );

    // Security: Validate archive size to prevent zip bombs
    const archiveStats = fs.statSync(archivePath);
    const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024; // 500MB
    if (archiveStats.size > MAX_ARCHIVE_SIZE) {
      throw new Error(
        `Archive too large (${(archiveStats.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed: 500MB`
      );
    }

    // Extract archive
    const extractPath = path.join(tempDir, 'extracted');
    fs.mkdirSync(extractPath, { recursive: true });

    // Use tar to extract with security filters
    const tar = await import('tar');
    let fileCount = 0;
    const MAX_FILES = 10000;

    await tar.x({
      file: archivePath,
      cwd: extractPath,
      strip: 1,
      preservePaths: false,
      strict: true,
      filter: (tarPath: string, entry: ReadEntry | fs.Stats) => {
        // Security: Limit file count to prevent resource exhaustion
        fileCount++;
        if (fileCount > MAX_FILES) {
          throw new Error(`Archive contains too many files (>${MAX_FILES})`);
        }

        if (!entry || typeof entry !== 'object') {
          console.warn(`[Security] Missing archive entry metadata for: ${tarPath}`);
          return false;
        }

        const entryType =
          'type' in entry && typeof entry.type === 'string' ? entry.type : undefined;
        if (entryType !== 'File' && entryType !== 'Directory') {
          return false;
        }

        const candidatePathRaw =
          'path' in entry && typeof entry.path === 'string' ? entry.path : tarPath;
        const candidatePath = typeof candidatePathRaw === 'string' ? candidatePathRaw : '';

        if (candidatePath) {
          if (path.isAbsolute(candidatePath)) {
            console.warn(`[Security] Blocked absolute path in archive: ${candidatePath}`);
            return false;
          }

          const normalized = candidatePath.replace(/\\/g, '/');
          const segments = normalized.split('/').filter(Boolean);
          if (segments.includes('..')) {
            console.warn(`[Security] Blocked path traversal in archive: ${candidatePath}`);
            return false;
          }
        }

        return true;
      },
    });

    // Cleanup archive to avoid disk space leaks
    try {
      fs.unlinkSync(archivePath);
    } catch (err) {
      // Best-effort cleanup; ignore errors
      void err;
    }

    return { extractPath, branch: targetBranch, repoInfo };
  } catch (error) {
    // Cleanup on error
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}
