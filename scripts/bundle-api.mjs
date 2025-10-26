#!/usr/bin/env node
/**
 * Bundle API using esbuild
 * 
 * This script bundles the API server code into a single file while:
 * - Externalizing all npm dependencies (they'll be installed separately)
 * - Bundling workspace packages (@dxlander/*) into the output
 * - Collecting dependencies from workspace packages for package.json
 */

import { build } from 'esbuild';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function bundleAPI() {
    // Read API package.json to get its direct dependencies
    const apiPackageJsonPath = path.join(rootDir, 'apps', 'api', 'package.json');
    const apiPackageJson = JSON.parse(await readFile(apiPackageJsonPath, 'utf-8'));

    // Workspace packages that are bundled into the API
    const workspacePackages = [
        'packages/shared/package.json',
        'packages/database/package.json',
        'packages/ai-agents/package.json',
    ];

    const allDeps = new Set(Object.keys(apiPackageJson.dependencies || {}));

    // Collect dependencies from workspace packages (they'll be bundled)
    for (const pkgPath of workspacePackages) {
        const pkgJsonPath = path.join(rootDir, pkgPath);
        try {
            const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
            Object.keys(pkgJson.dependencies || {}).forEach(dep => allDeps.add(dep));
        } catch (error) {
            // Package might not exist, skip
        }
    }

    // External packages: all npm dependencies (excluding workspace @dxlander/* packages)
    const externalDeps = Array.from(allDeps).filter(dep => !dep.startsWith('@dxlander/'));

    try {
        await build({
            entryPoints: [path.join(rootDir, 'apps', 'api', 'src', 'index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node18',
            format: 'esm',
            outfile: path.join(rootDir, 'apps', 'api', 'dist', 'index.js'),
            external: externalDeps,
            banner: {
                js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
            }
        });

        console.log('✓API bundled successfully');

    } catch (error) {
        console.error('✗ Failed to bundle API');
        console.error(error);
        process.exit(1);
    }
}

bundleAPI();
