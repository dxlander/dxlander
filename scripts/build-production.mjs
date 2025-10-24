#!/usr/bin/env node
/**
 * DXLander Production Build Script
 * 
 * Creates a production-ready npm package that combines:
 * - Next.js web app (standalone build with embedded node_modules)
 * - Hono.js API server (bundled with esbuild + npm deps via pnpm deploy)
 * 
 * Build process:
 * 1. Clean previous build output
 * 2. Install dependencies and build workspace packages
 * 3. Bundle API with esbuild (bundles workspace code, externalizes npm packages)
 * 4. Deploy API with pnpm deploy (installs all npm deps including native modules)
 * 5. Copy Next.js standalone build
 * 6. Copy CLI entry point from bin/dxlander.js
 * 
 * Output: dist-production/ directory ready for `npm publish`
 * 
 * Note: For development, use `pnpm dev` directly instead of the CLI.
 * The CLI (bin/dxlander.js) is only for the distributed npm package.
 * 
 * Architecture:
 * - Workspace packages (@dxlander/*) are bundled into API code
 * - NPM packages are external and installed via pnpm deploy
 * - This ensures native modules work and the bundle stays maintainable
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { rm, mkdir, cp, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Configuration
const config = {
  compiledDir: path.join(rootDir, 'dist-production'),
  rootDir: rootDir,
  webDir: path.join(rootDir, 'apps', 'web'),
  apiDir: path.join(rootDir, 'apps', 'api'),
};

// Helper functions
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };

  const prefix = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗'
  };

  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
}

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

async function runCommand(command, description) {
  log(description, 'info');
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: config.rootDir,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('npm warn')) console.error(stderr);

    return { stdout, stderr };
  } catch (error) {
    log(`Failed: ${description}`, 'error');
    console.error(error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

// Main build process
async function build() {
  const startTime = Date.now();

  try {
    printHeader('DXLander Production Build');

    log('Cleaning previous build output...', 'info');
    if (existsSync(config.compiledDir)) {
      await rm(config.compiledDir, { recursive: true, force: true });
    }
    await mkdir(config.compiledDir, { recursive: true });
    log('Build directory cleaned', 'success');

    await runCommand(
      'pnpm install',
      'Installing dependencies...'
    );
    log('Dependencies installed', 'success');

    // Build workspace packages
    await runCommand(
      'pnpm --filter=!@dxlander/api --filter=!@dxlander/integrations --filter=!@dxlander/config-gen build',
      'Building workspace packages...'
    );
    log('Workspace packages built successfully', 'success');

    // Bundle all TypeScript/JavaScript code but keep native modules external
    log('Bundling API with esbuild...', 'info');

    try {
      const { stdout, stderr } = await execAsync('node scripts/bundle-api.mjs', {
        cwd: config.rootDir,
        maxBuffer: 10 * 1024 * 1024
      });
      if (stdout) console.log(stdout);
      if (stderr && !stderr.toLowerCase().includes('warn')) console.error(stderr);
    } catch (error) {
      log('Failed to bundle API', 'error');
      throw error;
    }
    log('API bundled successfully', 'success');

    // Deploy API with pnpm deploy, handles native modules, peer dependencies, and workspace deps correctly
    log('Deploying API with pnpm deploy...', 'info');
    const apiDeployPath = path.join(config.compiledDir, 'api-deploy');

    try {
      const { stdout, stderr } = await execAsync(
        `pnpm --filter=@dxlander/api --prod deploy "${apiDeployPath}"`,
        {
          cwd: config.rootDir,
          maxBuffer: 10 * 1024 * 1024
        }
      );
      if (stdout) console.log(stdout);
      if (stderr && !stderr.includes('warn')) console.error(stderr);
    } catch (error) {
      log('Failed to deploy API', 'error');
      throw error;
    }

    log('Organizing API structure...', 'info');
    const apiDestPath = path.join(config.compiledDir, 'apps', 'api');
    await mkdir(apiDestPath, { recursive: true });

    const apiPackageJson = JSON.parse(
      await readFile(path.join(config.apiDir, 'package.json'), 'utf-8')
    );

    // Copy node_modules from pnpm deploy (includes all deps with native bindings)
    await cp(
      path.join(apiDeployPath, 'node_modules'),
      path.join(apiDestPath, 'node_modules'),
      { recursive: true }
    );

    await cp(
      path.join(config.apiDir, 'dist'),
      path.join(apiDestPath, 'dist'),
      { recursive: true }
    );

    await cp(
      path.join(config.apiDir, 'src'),
      path.join(apiDestPath, 'src'),
      { recursive: true }
    );

    await cp(
      path.join(config.apiDir, 'tsconfig.json'),
      path.join(apiDestPath, 'tsconfig.json')
    );

    // Create clean package.json with only npm dependencies (no workspace deps)
    const cleanDeps = Object.fromEntries(
      Object.entries(apiPackageJson.dependencies || {})
        .filter(([name]) => !name.startsWith('@dxlander/'))
    );

    await writeFile(
      path.join(apiDestPath, 'package.json'),
      JSON.stringify({
        name: '@dxlander/api',
        version: '0.1.0',
        private: true,
        type: 'module',
        dependencies: cleanDeps
      }, null, 2)
    );

    // Clean up temporary deploy directory
    await rm(apiDeployPath, { recursive: true, force: true });

    log('API structure organized', 'success');

    // Copy Next.js standalone build
    // Next.js standalone mode (output: "standalone") creates a self-contained
    // build with all dependencies, including node_modules, embedded
    log('Copying Next.js standalone build...', 'info');
    const standaloneDir = path.join(config.webDir, '.next', 'standalone');

    if (!existsSync(standaloneDir)) {
      throw new Error('Next.js standalone build not found. Make sure output: "standalone" is set in next.config.ts');
    }

    // Copy the entire standalone directory structure (it includes node_modules)
    await cp(standaloneDir, config.compiledDir, {
      recursive: true,
      force: true
    });

    // Copy static files and public assets to the web directory
    const nextStaticSrc = path.join(config.webDir, '.next', 'static');
    const nextStaticDest = path.join(config.compiledDir, 'apps', 'web', '.next', 'static');
    if (existsSync(nextStaticSrc)) {
      await cp(nextStaticSrc, nextStaticDest, { recursive: true });
    }

    const publicSrc = path.join(config.webDir, 'public');
    const publicDest = path.join(config.compiledDir, 'apps', 'web', 'public');
    if (existsSync(publicSrc)) {
      await cp(publicSrc, publicDest, { recursive: true });
    }

    // Define web destination path for later use
    const webDestPath = path.join(config.compiledDir, 'apps', 'web');

    // Create clean package.json for Web with only npm dependencies
    const webPackageJson = JSON.parse(
      await readFile(path.join(webDestPath, 'package.json'), 'utf-8')
    );
    const webCleanDeps = Object.fromEntries(
      Object.entries(webPackageJson.dependencies || {})
        .filter(([name]) => !name.startsWith('@dxlander/'))
    );
    await writeFile(
      path.join(webDestPath, 'package.json'),
      JSON.stringify({
        name: '@dxlander/web',
        version: '0.1.0',
        private: true,
        dependencies: webCleanDeps
      }, null, 2)
    );

    log('Next.js build copied', 'success');

    log('Copying CLI entry point...', 'info');

    const cliSource = path.join(config.rootDir, 'bin', 'dxlander.js');
    const cliDest = path.join(config.compiledDir, 'bin', 'dxlander');

    if (!existsSync(cliSource)) {
      throw new Error('CLI source file not found: bin/dxlander.js');
    }

    await cp(cliSource, cliDest);

    // Make executable
    await writeFile(cliDest, await readFile(cliDest, 'utf-8'), { mode: 0o755 });

    // Create Windows batch file
    const windowsScript = `@echo off
node "%~dp0\\dxlander" %*
`;

    await writeFile(
      path.join(config.compiledDir, 'bin', 'dxlander.cmd'),
      windowsScript
    );

    log('CLI entry points created', 'success');

    log('Creating distribution package.json...', 'info');

    const rootPackageJson = JSON.parse(
      await readFile(path.join(config.rootDir, 'package.json'), 'utf-8')
    );

    // Get web dependencies from the original web app
    const webAppPackageJson = JSON.parse(
      await readFile(path.join(config.webDir, 'package.json'), 'utf-8')
    );

    // Extract all web dependencies (excluding workspace packages)
    const runtimeDeps = Object.fromEntries(
      Object.entries(webAppPackageJson.dependencies || {})
        .filter(([name]) => !name.startsWith('@dxlander/'))
    );

    const distPackageJson = {
      name: rootPackageJson.name,
      version: rootPackageJson.version,
      description: rootPackageJson.description,
      main: 'bin/dxlander',
      bin: {
        dxlander: './bin/dxlander'
      },
      engines: {
        node: '>=18.0.0'
      },
      keywords: rootPackageJson.keywords,
      author: rootPackageJson.author,
      license: rootPackageJson.license,
      repository: rootPackageJson.repository,
      bugs: rootPackageJson.bugs,
      homepage: rootPackageJson.homepage,
      dependencies: runtimeDeps
    };

    await writeFile(
      path.join(config.compiledDir, 'package.json'),
      JSON.stringify(distPackageJson, null, 2)
    );
    log('Distribution package.json created', 'success');

    log('Copying essential files...', 'info');
    const filesToCopy = ['README.md', 'LICENSE'];

    for (const file of filesToCopy) {
      const src = path.join(config.rootDir, file);
      if (existsSync(src)) {
        await cp(src, path.join(config.compiledDir, file));
      }
    }
    log('Essential files copied', 'success');

    // Create .npmignore to exclude node_modules from tarball
    // npm only excludes root node_modules by default, not nested ones
    log('Creating .npmignore...', 'info');
    const npmignoreContent = `# Exclude all node_modules directories
# They will be installed on first run by the CLI
node_modules/
**/node_modules/
`;

    await writeFile(
      path.join(config.compiledDir, '.npmignore'),
      npmignoreContent
    );
    log('.npmignore created', 'success');

    // Calculate build time
    const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);

    printHeader('Build Complete');
    log(`Build completed in ${buildTime}s`, 'success');
    log(`Output directory: ${config.compiledDir}`, 'info');
    console.log('');
    log('To test locally:', 'info');
    console.log(`  cd ${config.compiledDir}`);
    console.log('  npm pack');
    console.log('  npm install -g dxlander-*.tgz');
    console.log('  dxlander');
    console.log('');
    log('To publish:', 'info');
    console.log(`  cd ${config.compiledDir}`);
    console.log('  npm publish --access public');
    console.log('');

  } catch (error) {
    log('Build failed!', 'error');
    console.error(error);
    process.exit(1);
  }
}

build();
