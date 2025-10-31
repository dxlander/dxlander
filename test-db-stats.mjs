#!/usr/bin/env node

/**
 * Quick test script to verify getDatabaseStats() works
 */

import { getDatabaseStats } from './packages/database/dist/db.js';

console.log('🔍 Testing getDatabaseStats()...\n');

try {
  const stats = await getDatabaseStats();
  
  console.log('✅ Database Stats Retrieved:');
  console.log('─'.repeat(50));
  console.log(`📁 Database Path: ${stats.dbPath}`);
  console.log(`💾 File Size: ${(stats.fileSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`📊 Tables Count: ${stats.tablesCount}`);
  console.log(`📝 Total Records: ${stats.totalRecords}`);
  console.log('\n📋 Per-Table Breakdown:');
  console.log('─'.repeat(50));
  
  if (stats.perTable.length === 0) {
    console.log('  (No user tables found)');
  } else {
    stats.perTable
      .sort((a, b) => b.count - a.count)
      .forEach(table => {
        console.log(`  • ${table.name.padEnd(30)} ${table.count.toString().padStart(6)} records`);
      });
  }
  
  console.log('─'.repeat(50));
  console.log('\n✅ Test completed successfully!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
