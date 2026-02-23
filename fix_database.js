const Database = require('better-sqlite3');
const db = new Database('/a0/usr/projects/project_1/data/farm.db');

try {
  // Check if column exists
  const columns = db.prepare("PRAGMA table_info(followed_channels)").all();
  const hasViewerCount = columns.some(col => col.name === 'viewer_count');
  
  if (!hasViewerCount) {
    console.log('Adding viewer_count column...');
    db.prepare('ALTER TABLE followed_channels ADD COLUMN viewer_count INTEGER DEFAULT 0').run();
    console.log('✅ viewer_count column added');
  } else {
    console.log('✅ viewer_count column already exists');
  }
  
  // Update any existing records to have viewer_count = 0
  db.prepare('UPDATE followed_channels SET viewer_count = 0 WHERE viewer_count IS NULL').run();
  
} catch (error) {
  console.error('Migration error:', error.message);
} finally {
  db.close();
}
