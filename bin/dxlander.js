#!/usr/bin/env node

/**
 * DXLander CLI Entry Point (Production)
 *
 * This file is used in the distributed npm package.
 * It runs both the API and Web servers in production mode.
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DXLANDER_HOME = path.join(os.homedir(), '.dxlander');
const DATA_DIR = path.join(DXLANDER_HOME, 'data');
const PKG_ROOT = path.join(__dirname, '..');

console.log('DXLander - AI-Powered Deployment Automation');
console.log('='.repeat(60));
console.log('');

// Ensure directories exist
function ensureDirectories() {
  const dirs = [
    DXLANDER_HOME,
    DATA_DIR,
    path.join(DXLANDER_HOME, 'config'),
    path.join(DXLANDER_HOME, 'logs'),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created: ${dir.replace(os.homedir(), '~')}`);
    }
  });
}

ensureDirectories();

// Check and install dependencies if needed
function checkDependencies() {
  const apiNodeModules = path.join(PKG_ROOT, 'apps', 'api', 'node_modules');
  const webNodeModules = path.join(PKG_ROOT, 'node_modules');

  const apiNeedsInstall = !fs.existsSync(apiNodeModules);
  const webNeedsInstall = !fs.existsSync(webNodeModules);

  if (apiNeedsInstall || webNeedsInstall) {
    console.log('📦 Installing dependencies (first run)...');
    console.log('   This may take a few minutes.');
    console.log('');

    try {
      // Install API dependencies
      if (apiNeedsInstall) {
        console.log('   Installing API dependencies...');
        const apiDir = path.join(PKG_ROOT, 'apps', 'api');
        execSync('npm install --production --no-audit --no-fund', {
          cwd: apiDir,
          stdio: 'inherit',
        });
      }

      // Install Web/Next.js dependencies
      if (webNeedsInstall) {
        console.log('   Installing Web dependencies...');
        execSync('npm install --production --no-audit --no-fund', {
          cwd: PKG_ROOT,
          stdio: 'inherit',
        });
      }

      console.log('');
      console.log('✅ Dependencies installed successfully');
      console.log('');
    } catch (error) {
      console.error('❌ Failed to install dependencies:', error.message);
      console.error('');
      console.error('Please ensure you have npm installed and try again.');
      process.exit(1);
    }
  }
}

checkDependencies();

const isFirstRun = !fs.existsSync(path.join(DATA_DIR, 'dxlander.db'));

console.log('🌐 Starting servers...');
console.log(`   API:      http://localhost:${process.env.API_PORT || 3001}`);
console.log(`   Web:      http://localhost:${process.env.WEB_PORT || 3000}`);
if (isFirstRun) {
  console.log('   Setup:    http://localhost:3000/setup');
}
console.log('');
console.log('Press Ctrl+C to stop');
console.log('');

// Start API server
const apiPath = path.join(__dirname, '..', 'apps', 'api', 'dist', 'index.js');
const apiCwd = path.join(__dirname, '..', 'apps', 'api');
const apiProcess = spawn('node', [apiPath], {
  cwd: apiCwd,
  env: {
    ...process.env,
    DXLANDER_HOME,
    NODE_ENV: 'production',
    PORT: process.env.API_PORT || '3001',
  },
  stdio: 'inherit',
});

// Start Next.js server
const webServerPath = path.join(__dirname, '..', 'apps', 'web', 'server.js');
const webProcess = spawn('node', [webServerPath], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.WEB_PORT || '3000',
    HOSTNAME: '0.0.0.0',
  },
  stdio: 'inherit',
});

// Handle graceful shutdown
function shutdown() {
  console.log('\n👋 Shutting down DXLander...');
  apiProcess.kill('SIGTERM');
  webProcess.kill('SIGTERM');

  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

apiProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ API server exited with code ${code}`);
    shutdown();
  }
});

webProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Web server exited with code ${code}`);
    shutdown();
  }
});
