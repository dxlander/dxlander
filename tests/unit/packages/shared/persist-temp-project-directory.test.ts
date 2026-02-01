import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  persistTempProjectDirectory,
  getProjectDir,
  getRelativeProjectPath,
} from '../../../../packages/shared/src/services/file-storage';

const PROJECT_ID = 'test-project';

describe('persistTempProjectDirectory', () => {
  const originalHome = process.env.DXLANDER_HOME;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dxlander-home-'));

  beforeAll(() => {
    process.env.DXLANDER_HOME = tempHome;
  });

  afterAll(() => {
    process.env.DXLANDER_HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('moves extracted contents into permanent storage and computes stats', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dxlander-extract-'));
    const extractPath = path.join(tempRoot, 'extracted');
    fs.mkdirSync(extractPath, { recursive: true });

    const files = [
      { relative: 'README.md', contents: '# Hello world' },
      { relative: path.join('src', 'index.ts'), contents: 'console.log("test");' },
    ];

    for (const file of files) {
      const fullPath = path.join(extractPath, file.relative);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.contents);
    }

    const result = persistTempProjectDirectory(PROJECT_ID, extractPath);

    const projectRoot = getProjectDir(PROJECT_ID);
    // localPath is now returned as RELATIVE path for portability
    expect(result.localPath).toBe(getRelativeProjectPath(projectRoot));
    expect(result.filesCount).toBe(files.length);

    const expectedSize = files.reduce((total, file) => total + Buffer.byteLength(file.contents), 0);
    expect(result.totalSize).toBe(expectedSize);

    // Files are stored in the /files subdirectory
    for (const file of files) {
      const copiedPath = path.join(projectRoot, 'files', file.relative);
      expect(fs.existsSync(copiedPath)).toBe(true);
      expect(fs.readFileSync(copiedPath, 'utf-8')).toBe(file.contents);
    }

    expect(fs.existsSync(tempRoot)).toBe(false);
  });
});
