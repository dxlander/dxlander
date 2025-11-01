import Database from 'better-sqlite3';
import { getDatabaseFilePath, getDatabaseStats } from '@dxlander/database';
import * as fs from 'fs';

const dbPath = getDatabaseFilePath();
let sqlite;

console.log('🔍 Testing Database Stats Function\n');
console.log('📁 Database Path:', dbPath);
console.log('─'.repeat(60));

try {
  sqlite = new Database(dbPath);
  // Get file stats
  const fileStats = fs.statSync(dbPath);
  console.log(`💾 File Size: ${fileStats.size} bytes (${(fileStats.size / 1024).toFixed(2)} KB)`);

  // Query database for table information
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    .all();
  console.log(`📊 Tables Count: ${tables.length}`);

  let totalRecords = 0;
  const perTable = [];

  console.log('\n📋 Per-Table Breakdown:');
  console.log('─'.repeat(60));

  for (const table of tables) {
    try {
      const result = sqlite.prepare(`SELECT COUNT(*) as cnt FROM "${table.name}";`).get();
      const count = result?.cnt || 0;
      totalRecords += count;
      perTable.push({ name: table.name, count });
      console.log(`  • ${table.name.padEnd(30)} ${String(count).padStart(6)} records`);
    } catch (err) {
      console.log(`  ⚠️  ${table.name.padEnd(30)} ERROR: ${err.message}`);
    }
  }

  console.log('─'.repeat(60));
  console.log(`📝 Total Records: ${totalRecords}`);
  console.log('\n✅ Database stats retrieved successfully!');

  // Test the actual function
  console.log('\n\n🧪 Testing getDatabaseStats() function...\n');
  const stats = await getDatabaseStats();

  console.log('Result from getDatabaseStats():');
  console.log(JSON.stringify(stats, null, 2));

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  if (sqlite) {
    sqlite.close();
  }
}
