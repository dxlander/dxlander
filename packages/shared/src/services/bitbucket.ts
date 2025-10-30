import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';

export interface BitbucketConfig {
  username: string;
  appPassword: string;
  workspace?: string;
  repo?: string;
}

export interface BitbucketRepoInfo {
  uuid: string;
  name: string;
  description: string;
  mainBranch: string;
  url: string;
  cloneUrl: string;
  size: number;
}

export class BitbucketService {
  private client: AxiosInstance;
  private config: BitbucketConfig; // ✅ store full config

  constructor(config: BitbucketConfig) {
    this.config = config; // ✅ assign config

    this.client = axios.create({
      baseURL: 'https://api.bitbucket.org/2.0',
      auth: {
        username: config.username,
        password: config.appPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getRepository(workspace: string, repoSlug: string): Promise<BitbucketRepoInfo> {
    try {
      const { data } = await this.client.get(`/repositories/${workspace}/${repoSlug}`);
      const mainBranch = data.mainbranch?.name || 'main';

      return {
        uuid: data.uuid,
        name: data.name,
        description: data.description || '',
        mainBranch,
        url: data.links.html.href,
        cloneUrl:
          data.links.clone.find((l: { name?: string; href?: string }) => l.name === 'https')
            ?.href || '',
        size: data.size || 0,
      };
    } catch (error: unknown) {
      // Security: Safe logging without exposing credentials
      const axiosErr = error as { response?: { status?: number; statusText?: string } };
      console.error('Bitbucket API error:', {
        status: axiosErr?.response?.status,
        statusText: axiosErr?.response?.statusText,
        workspace,
        repoSlug,
      });
      throw new Error('Failed to fetch Bitbucket repository');
    }
  }

  async downloadRepository(
    workspace: string,
    repoSlug: string,
    branch: string,
    outputPath: string
  ): Promise<string> {
    try {
      // ✅ use correct endpoint for downloading
      const url = `https://bitbucket.org/${workspace}/${repoSlug}/get/${encodeURIComponent(branch)}.tar.gz`;

      // ✅ use the axios import at the top — no need to re-import dynamically
      const { data } = await axios.get(url, {
        responseType: 'arraybuffer',
        auth: {
          username: this.config.username,
          password: this.config.appPassword,
        },
      });

      const archivePath = path.join(outputPath, `${repoSlug}-${branch}.tar.gz`);
      fs.writeFileSync(archivePath, data);

      return archivePath;
    } catch (error: unknown) {
      // Security: Safe logging without exposing credentials
      const axiosErr = error as { response?: { status?: number; statusText?: string } };
      console.error('Bitbucket download error:', {
        status: axiosErr?.response?.status,
        statusText: axiosErr?.response?.statusText,
        workspace,
        repoSlug,
        branch,
      });
      throw new Error('Failed to download Bitbucket repository');
    }
  }

  async listBranches(workspace: string, repoSlug: string): Promise<string[]> {
    try {
      const { data } = await this.client.get(
        `/repositories/${workspace}/${repoSlug}/refs/branches`
      );
      return data.values.map((b: any) => b.name);
    } catch (error: unknown) {
      // Security: Safe logging without exposing credentials
      const axiosErr = error as { response?: { status?: number; statusText?: string } };
      console.error('Bitbucket branches error:', {
        status: axiosErr?.response?.status,
        statusText: axiosErr?.response?.statusText,
        workspace,
        repoSlug,
      });
      throw new Error('Failed to list Bitbucket branches');
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.client.get('/user');
      return true;
    } catch {
      return false;
    }
  }
}
