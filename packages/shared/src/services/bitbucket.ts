import axios, { AxiosInstance } from 'axios';

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
  private username: string;
  private appPassword: string;

  constructor(config: BitbucketConfig) {
    this.username = config.username;
    this.appPassword = config.appPassword;

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
        cloneUrl: data.links.clone.find((l: any) => l.name === 'https')?.href || '',
        size: data.size || 0,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to fetch Bitbucket repository: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }

  async downloadRepository(
    workspace: string,
    repoSlug: string,
    branch: string = 'main',
    outputPath: string
  ): Promise<string> {
    try {
      const { data } = await this.client.get(
        `/repositories/${workspace}/${repoSlug}/downloads/${branch}.tar.gz`,
        { responseType: 'arraybuffer' }
      );

      const fs = await import('fs');
      const path = await import('path');

      const archivePath = path.join(outputPath, `${repoSlug}-${branch}.tar.gz`);
      fs.writeFileSync(archivePath, data);

      return archivePath;
    } catch (error: any) {
      throw new Error(
        `Failed to download Bitbucket repository: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }

  async listBranches(workspace: string, repoSlug: string): Promise<string[]> {
    try {
      const { data } = await this.client.get(
        `/repositories/${workspace}/${repoSlug}/refs/branches`
      );
      return data.values.map((b: any) => b.name);
    } catch (error: any) {
      throw new Error(
        `Failed to list Bitbucket branches: ${error.response?.data?.error?.message || error.message}`
      );
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
