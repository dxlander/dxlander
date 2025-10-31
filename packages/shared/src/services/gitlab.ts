import { Gitlab } from '@gitbeaker/rest';
import axios from 'axios';

export interface GitLabConfig {
  url?: string; // For self-hosted instances
  token: string;
  projectId?: string;
  namespace?: string;
  repo?: string;
}

export interface GitLabRepoInfo {
  id: number;
  name: string;
  description: string;
  defaultBranch: string;
  url: string;
  cloneUrl: string;
  size: number;
}

export class GitLabService {
  // NOTE: Using 'any' due to complex @gitbeaker/rest types that don't match runtime API
  // TODO: Investigate proper typing for Gitlab client
  private client: any;

  constructor(config: GitLabConfig) {
    this.client = new Gitlab({
      host: config.url || 'https://gitlab.com',
      token: config.token,
    });
  }

  async getRepository(projectId: string): Promise<GitLabRepoInfo> {
    try {
      const project = await this.client.Projects.show(projectId);

      return {
        id: project.id,
        name: project.name,
        description: project.description || '',
        defaultBranch: project.default_branch || 'main',
        url: project.web_url,
        cloneUrl: project.http_url_to_repo,
        size: project.statistics?.repository_size || 0,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch GitLab repository: ${error.message}`);
    }
  }

  async downloadRepository(
    projectId: string,
    branch: string = 'main',
    outputPath: string
  ): Promise<string> {
    try {
      const archiveBuffer = await this.client.Projects.downloadArchive(projectId, {
        sha: branch,
      });

      const fs = await import('fs');
      const path = await import('path');

      // Security: Sanitize filename to prevent path traversal from branch names like "feature/foo"
      const sanitizedProjectId = projectId.replace(/[/\\:*?"<>|]/g, '_');
      const sanitizedBranch = branch.replace(/[/\\:*?"<>|]/g, '_');
      const archivePath = path.join(outputPath, `${sanitizedProjectId}-${sanitizedBranch}.tar.gz`);

      fs.writeFileSync(archivePath, archiveBuffer);

      return archivePath;
    } catch (error: any) {
      throw new Error(`Failed to download GitLab repository: ${error.message}`);
    }
  }

  async listBranches(projectId: string): Promise<string[]> {
    try {
      const branches = await this.client.Branches.all(projectId);
      return branches.map((b: any) => b.name);
    } catch (error: any) {
      throw new Error(`Failed to list GitLab branches: ${error.message}`);
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      const host = this.client.options.host || 'https://gitlab.com';
      const token = this.client.options.token;

      const response = await axios.get(`${host}/api/v4/user`, {
        headers: {
          'PRIVATE-TOKEN': token,
        },
      });

      return response.status === 200;
    } catch (error) {
      console.error('GitLab token validation failed with axios:', error);
      return false;
    }
  }
}
