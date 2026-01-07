#!/usr/bin/env node
/**
 * Migration Script: Convert Absolute Paths to Relative Paths
 * 
 * This script updates existing projects and config_sets in the database
 * to use relative paths instead of absolute paths.
 * 
 * Usage: node migrate-to-relative-paths.mjs
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join, resolve, relative, isAbsolute } from 'path';
import { existsSync } from 'fs';

// Determine data directory
function getDataDir() {
    if (process.env.DXLANDER_HOME) {
        return join(process.env.DXLANDER_HOME, 'data');
    }
    return join(homedir(), '.dxlander', 'data');
}

function getDXLanderHome() {
    if (process.env.DXLANDER_HOME) {
        return process.env.DXLANDER_HOME;
    }
    return join(homedir(), '.dxlander');
}

const dataDir = getDataDir();
const dbPath = join(dataDir, 'dxlander.db');

if (!existsSync(dbPath)) {
    console.log('❌ Database not found at:', dbPath);
    console.log('   Make sure you have run DXLander at least once.');
    process.exit(1);
}

console.log('🔄 Starting migration: Absolute paths → Relative paths');
console.log('   Database:', dbPath);
console.log('   DXLANDER_HOME:', getDXLanderHome());
console.log('');

// Open database
const db = new Database(dbPath);

try {
    // Start transaction
    db.exec('BEGIN TRANSACTION');

    const dxlanderHome = resolve(getDXLanderHome());

    // Migrate projects table
    console.log('📦 Migrating projects table...');
    const projects = db.prepare('SELECT id, local_path FROM projects WHERE local_path IS NOT NULL').all();

    let projectsUpdated = 0;
    for (const project of projects) {
        const { id, local_path } = project;

        // Skip if already relative
        if (!isAbsolute(local_path)) {
            console.log(`   ✓ Project ${id}: Already relative`);
            continue;
        }

        // Convert to relative path
        const resolvedPath = resolve(local_path);
        if (!resolvedPath.startsWith(dxlanderHome)) {
            console.log(`   ⚠ Project ${id}: Path not in DXLANDER_HOME, skipping`);
            continue;
        }

        const relativePath = relative(dxlanderHome, resolvedPath);

        // Update database
        db.prepare('UPDATE projects SET local_path = ? WHERE id = ?').run(relativePath, id);
        projectsUpdated++;
        console.log(`   ✓ Project ${id}: ${local_path} → ${relativePath}`);
    }

    console.log(`   Updated ${projectsUpdated} project(s)`);
    console.log('');

    // Migrate config_sets table
    console.log('⚙️  Migrating config_sets table...');
    const configSets = db.prepare('SELECT id, local_path FROM config_sets WHERE local_path IS NOT NULL').all();

    let configsUpdated = 0;
    for (const config of configSets) {
        const { id, local_path } = config;

        // Skip if already relative
        if (!isAbsolute(local_path)) {
            console.log(`   ✓ Config ${id}: Already relative`);
            continue;
        }

        // Convert to relative path
        const resolvedPath = resolve(local_path);
        if (!resolvedPath.startsWith(dxlanderHome)) {
            console.log(`   ⚠ Config ${id}: Path not in DXLANDER_HOME, skipping`);
            continue;
        }

        const relativePath = relative(dxlanderHome, resolvedPath);

        // Update database
        db.prepare('UPDATE config_sets SET local_path = ? WHERE id = ?').run(relativePath, id);
        configsUpdated++;
        console.log(`   ✓ Config ${id}: ${local_path} → ${relativePath}`);
    }

    console.log(`   Updated ${configsUpdated} config set(s)`);
    console.log('');

    // Commit transaction
    db.exec('COMMIT');

    console.log('✅ Migration completed successfully!');
    console.log(`   Total projects updated: ${projectsUpdated}`);
    console.log(`   Total config sets updated: ${configsUpdated}`);
    console.log('');
    console.log('🎉 You can now safely rename or move your .dxlander folder!');

} catch (error) {
    // Rollback on error
    db.exec('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('   No changes were made to the database.');
    process.exit(1);
} finally {
    db.close();
}
