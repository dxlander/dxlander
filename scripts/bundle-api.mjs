#!/usr/bin/env node
/**
 * Bundle API using esbuild
 */

import { build } from 'esbuild';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function bundleAPI() {
    // Read API package.json to get dependencies
    const apiPackageJsonPath = path.join(rootDir, 'apps', 'api', 'package.json');
    const apiPackageJson = JSON.parse(await readFile(apiPackageJsonPath, 'utf-8'));

    // External packages: all npm dependencies except scoped @dxlander/*
    const externalDeps = Object.keys(apiPackageJson.dependencies || {})
        .filter(dep => !dep.startsWith('@dxlander/'));

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

    } catch (error) {
        console.error('✗ Failed to bundle API');
        console.error(error);
        process.exit(1);
    }
}

bundleAPI();
