export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
  isPrivate: boolean;
  defaultBranch?: string;
  description?: string;
  language?: string;
  size?: number;
  topics?: string[];
}

export interface GitHubFileTree {
  path: string;
  type: 'file' | 'dir';
  size?: number;
  url?: string;
  content?: string;
}

/**
 * Parse GitHub URL or owner/repo format
 * Examples:
 * - https://github.com/owner/repo
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  // Remove .git suffix if present
  const cleaned = input.trim().replace(/\.git$/, '');

  // Pattern 1: Full URL (https://github.com/owner/repo)
  const urlMatch = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // Pattern 2: owner/repo format
  const shortMatch = cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  return null;
}

/**
 * GitHub Service - Interacts with GitHub API
 */
export class GitHubService {
  private baseUrl = 'https://api.github.com';
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private get headers(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Get repository information
   */
  async getRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo> {
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or you don't have access`);
      }
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded or authentication required');
      }
      throw new Error(`Failed to fetch repository: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      owner: data.owner.login,
      repo: data.name,
      branch: data.default_branch,
      isPrivate: data.private,
      defaultBranch: data.default_branch,
      description: data.description,
      language: data.language,
      size: data.size,
      topics: data.topics || [],
    };
  }

  /**
   * Get repository file tree
   */
  async getFileTree(owner: string, repo: string, branch: string): Promise<GitHubFileTree[]> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      {
        headers: this.headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch repository tree: ${response.statusText}`);
    }

    const data = await response.json();

    return data.tree.map((item: any) => ({
      path: item.path,
      type: item.type === 'blob' ? 'file' : 'dir',
      size: item.size,
      url: item.url,
    }));
  }

  /**
   * Get file content from repository
   */
  async getFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: this.headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch file ${path}: ${response.statusText}`);
    }

    const data = await response.json();

    // Decode base64 content
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    throw new Error(`No content found for file: ${path}`);
  }

  /**
   * Get important files for analysis
   * (package.json, requirements.txt, etc.)
   */
  async getImportantFiles(
    owner: string,
    repo: string,
    branch: string
  ): Promise<Map<string, string>> {
    const importantFilePaths = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'requirements.txt',
      'Pipfile',
      'Cargo.toml',
      'go.mod',
      'composer.json',
      'Gemfile',
      'build.gradle',
      'pom.xml',
      'README.md',
      'README',
      '.env.example',
      '.env.template',
      'tsconfig.json',
      'next.config.js',
      'next.config.ts',
      'vite.config.js',
      'vite.config.ts',
      'nuxt.config.js',
      'nuxt.config.ts',
    ];

    const fileTree = await this.getFileTree(owner, repo, branch);
    const files = new Map<string, string>();

    // Find files that match our important files list
    const foundFiles = fileTree.filter(
      (item) =>
        item.type === 'file' &&
        importantFilePaths.some((path) => item.path.toLowerCase() === path.toLowerCase())
    );

    // Fetch content for each important file
    await Promise.all(
      foundFiles.map(async (file) => {
        try {
          const content = await this.getFileContent(owner, repo, file.path, branch);
          files.set(file.path, content);
        } catch (error) {
          console.warn(`Failed to fetch ${file.path}:`, error);
        }
      })
    );

    return files;
  }

  /**
   * Get all files from repository (for AI analysis)
   * Fetches all text-based files up to a reasonable limit
   */
  async getAllFiles(
    owner: string,
    repo: string,
    branch: string,
    maxFiles: number = 100,
    maxFileSize: number = 500000 // 500KB per file
  ): Promise<Map<string, string>> {
    const fileTree = await this.getFileTree(owner, repo, branch);
    const files = new Map<string, string>();

    // Filter for files only (not directories)
    const fileItems = fileTree.filter((item) => item.type === 'file');

    // Take first maxFiles files
    const filesToFetch = fileItems.slice(0, maxFiles);

    console.log(`Fetching ${filesToFetch.length} files from ${owner}/${repo}...`);

    // Fetch content for each file (with error handling)
    const fetchPromises = filesToFetch.map(async (file) => {
      try {
        // Skip binary files and very large files
        if (file.size && file.size > maxFileSize) {
          console.log(`Skipping large file: ${file.path} (${file.size} bytes)`);
          return;
        }

        // Skip common binary file extensions
        const binaryExtensions = [
          '.png',
          '.jpg',
          '.jpeg',
          '.gif',
          '.svg',
          '.ico',
          '.woff',
          '.woff2',
          '.ttf',
          '.eot',
          '.otf',
          '.mp4',
          '.mp3',
          '.pdf',
          '.zip',
          '.tar',
          '.gz',
        ];
        if (binaryExtensions.some((ext) => file.path.toLowerCase().endsWith(ext))) {
          console.log(`Skipping binary file: ${file.path}`);
          return;
        }

        const content = await this.getFileContent(owner, repo, file.path, branch);
        files.set(file.path, content);
      } catch (error: any) {
        // Log error but continue with other files
        console.warn(`Failed to fetch ${file.path}:`, error.message);
      }
    });

    await Promise.all(fetchPromises);

    return files;
  }

  /**
   * Clone repository metadata (with all files for AI analysis)
   */
  async cloneRepoMetadata(
    input: string,
    branch?: string,
    token?: string
  ): Promise<{
    repoInfo: GitHubRepoInfo;
    files: Map<string, string>;
    fileTree: GitHubFileTree[];
  }> {
    // Parse input
    const parsed = parseGitHubUrl(input);
    if (!parsed) {
      throw new Error('Invalid GitHub URL or owner/repo format');
    }

    // Use provided token or instance token
    const service = token ? new GitHubService(token) : this;

    // Get repo info
    const repoInfo = await service.getRepoInfo(parsed.owner, parsed.repo);

    // Use specified branch or default branch
    const targetBranch = branch || repoInfo.defaultBranch || 'main';

    // Get file tree
    const fileTree = await service.getFileTree(parsed.owner, parsed.repo, targetBranch);

    // Get ALL files from repository (for AI analysis)
    const files = await service.getAllFiles(parsed.owner, parsed.repo, targetBranch);

    return {
      repoInfo: { ...repoInfo, branch: targetBranch },
      files,
      fileTree,
    };
  }
}

// Export singleton instance
export const githubService = new GitHubService();
