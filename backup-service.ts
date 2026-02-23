import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class BackupService {
  private db: Database.Database;
  private dbPath: string;
  private backupDir: string;
  private backupInterval: NodeJS.Timeout | null = null;

  constructor(dbPath: string, backupDir: string = './backups') {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.backupDir = backupDir;
    this.ensureBackupDirectory();
  }

  private ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Create a timestamped backup of the database
   */
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `farm-db-backup-${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupFileName);
    
    try {
      // Use SQLite's backup API for reliable backups
      const backupDb = new Database(backupPath);
      
      // Perform online backup
      this.db.backup(backupDb);
      
      backupDb.close();
      
      console.log(`Database backup created: ${backupPath}`);
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      return backupPath;
    } catch (error: any) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Get list of all backups
   */
  getBackups(): Array<{ filename: string; path: string; size: number; created: Date }> {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    const files = fs.readdirSync(this.backupDir);
    const backups: Array<{ filename: string; path: string; size: number; created: Date }> = [];

    for (const file of files) {
      if (file.startsWith('farm-db-backup-') && file.endsWith('.db')) {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        
        // Extract timestamp from filename
        const match = file.match(/farm-db-backup-(.+?)\.db/);
        if (match) {
          const timestamp = match[1].replace(/-/g, ':');
          backups.push({
            filename: file,
            path: filePath,
            size: stats.size,
            created: new Date(timestamp)
          });
        }
      }
    }

    return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Clean up old backups (keep last 7 days)
   */
  async cleanupOldBackups(daysToKeep: number = 7): Promise<number> {
    const backups = this.getBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;

    for (const backup of backups) {
      if (backup.created < cutoffDate) {
        try {
          fs.unlinkSync(backup.path);
          console.log(`Deleted old backup: ${backup.filename}`);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting backup ${backup.filename}:`, error);
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old backups`);
    }

    return deletedCount;
  }

  /**
   * Restore from a specific backup
   */
  async restoreBackup(backupPath: string): Promise<boolean> {
    try {
      // Close current database connection
      this.db.close();

      // Create backup of current database before restoring
      const currentBackup = `${this.dbPath}.pre-restore`;
      fs.copyFileSync(this.dbPath, currentBackup);
      console.log(`Created pre-restore backup: ${currentBackup}`);

      // Copy backup to main database location
      fs.copyFileSync(backupPath, this.dbPath);
      console.log(`Database restored from: ${backupPath}`);

      // Reconnect to database
      this.db = new Database(this.dbPath);

      return true;
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      
      // Attempt to restore the pre-restore backup
      const currentBackup = `${this.dbPath}.pre-restore`;
      if (fs.existsSync(currentBackup)) {
        fs.copyFileSync(currentBackup, this.dbPath);
        console.log('Restored pre-restore backup due to error');
      }
      
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  getBackupStats() {
    const backups = this.getBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    
    return {
      totalBackups: backups.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      newestBackup: backups.length > 0 ? backups[0].created : null,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null
    };
  }

  /**
   * Start automated daily backups at midnight
   */
  startAutomatedBackups(hour: number = 0, minute: number = 0) {
    const now = new Date();
    const nextBackup = new Date();
    nextBackup.setHours(hour, minute, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1);
    }

    const delay = nextBackup.getTime() - now.getTime();
    console.log(`Scheduling first backup for: ${nextBackup.toISOString()}`);

    setTimeout(() => {
      this.createBackup();
      
      // Schedule daily backups
      this.backupInterval = setInterval(() => {
        this.createBackup();
      }, 24 * 60 * 60 * 1000); // Every 24 hours
      
      console.log('Automated daily backups started');
    }, delay);
  }

  /**
   * Stop automated backups
   */
  stopAutomatedBackups() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      console.log('Automated backups stopped');
    }
  }

  /**
   * Create immediate manual backup
   */
  async createManualBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `farm-db-manual-${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupFileName);
    
    try {
      const backupDb = new Database(backupPath);
      this.db.backup(backupDb);
      backupDb.close();
      
      console.log(`Manual backup created: ${backupPath}`);
      return backupPath;
    } catch (error: any) {
      console.error('Error creating manual backup:', error);
      throw error;
    }
  }
}
