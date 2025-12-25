#!/usr/bin/env node
/**
 * Docker Release Script
 * Builds and publishes Docker images to GitHub Container Registry
 * Uses version from package.json automatically
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Read version from package.json
const packageJson = JSON.parse(
    readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
);
const version = packageJson.version;

console.log('='.repeat(60));
console.log('  DXLander Docker Release');
console.log('='.repeat(60));
console.log('');
console.log(`📦 Version: ${version}`);
console.log('🐳 Registry: ghcr.io/dxlander/dxlander');
console.log('');

// Determine tags based on version
const tags = [`ghcr.io/dxlander/dxlander:${version}`];

// Always add 'latest' tag (matches npm behavior)
tags.push('ghcr.io/dxlander/dxlander:latest');

// For pre-releases, also add the channel tag (e.g., 'alpha', 'beta')
const match = version.match(/-(alpha|beta|rc)/);
if (match) {
    tags.push(`ghcr.io/dxlander/dxlander:${match[1]}`);
}

console.log('🏷️  Tags to be created:');
tags.forEach(tag => console.log(`   - ${tag}`));
console.log('');

try {
    // Step 1: Build production artifacts
    console.log('📦 Building production artifacts...');
    execSync('pnpm run build:production', {
        cwd: rootDir,
        stdio: 'inherit'
    });
    console.log('✅ Production build complete\n');

    // Step 2: Build Docker image with all tags
    console.log('🐳 Building Docker image...');
    const tagArgs = tags.map(tag => `-t ${tag}`).join(' ');
    execSync(`docker build ${tagArgs} .`, {
        cwd: rootDir,
        stdio: 'inherit'
    });
    console.log('✅ Docker image built\n');

    // Step 3: Check image size
    console.log('📊 Image details:');
    const imageInfo = execSync(`docker images ${tags[0]} --format "{{.Size}}"`, {
        cwd: rootDir,
        encoding: 'utf-8'
    }).trim();
    console.log(`   Size: ${imageInfo}`);
    console.log('');

    // Step 4: Push all tags
    console.log('🚀 Pushing images to registry...');
    for (const tag of tags) {
        console.log(`   Pushing ${tag}...`);
        execSync(`docker push ${tag}`, {
            cwd: rootDir,
            stdio: 'inherit'
        });
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('  ✅ Docker Release Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📦 Published images:');
    tags.forEach(tag => console.log(`   - ${tag}`));
    console.log('');
    console.log('🎉 Users can now pull with:');
    console.log(`   docker pull ghcr.io/dxlander/dxlander:${version}`);
    if (tags.includes('ghcr.io/dxlander/dxlander:latest')) {
        console.log('   docker pull ghcr.io/dxlander/dxlander:latest');
    }
    console.log('');

} catch (error) {
    console.error('');
    console.error('❌ Docker release failed:');
    console.error(error.message);
    process.exit(1);
}
