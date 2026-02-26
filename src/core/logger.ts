import fs from 'fs';
import path from 'path';
import { LOG_LEVEL, LOG_FILE_PATH, MAX_LOG_SIZE, MAX_LOG_FILES } from './config';

// ============================================
// TYPES
// ============================================

/**
 * Log severity levels
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Request log structure
 */
export interface RequestLog {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: string;
}

/**
 * Response log structure
 */
export interface ResponseLog {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  duration: number;
  timestamp: string;
}

// ============================================
// LOGGER CLASS
// ============================================

/**
 * Structured logger with file and console output
 */
class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logFilePath: string;
  private logDir: string;

  private constructor() {
    this.logLevel = this.parseLogLevel(LOG_LEVEL);
    this.logFilePath = LOG_FILE_PATH;
    this.logDir = path.dirname(this.logFilePath);
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Start log rotation check
    this.startLogRotation();
  }

  /**
   * Get logger instance (singleton)
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Parse log level string to enum
   */
  private parseLogLevel(level: string): LogLevel {
    const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    const parsed = level.toLowerCase() as LogLevel;
    return validLevels.includes(parsed) ? parsed : 'info';
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    return levels[level] <= levels[this.logLevel];
  }

  /**
   * Format log entry as JSON string
   */
  private formatLogEntry(entry: LogEntry): string {
    const baseEntry = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      ...entry.context
    };

    if (entry.error) {
      baseEntry.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack
      };
    }

    return JSON.stringify(baseEntry);
  }

  /**
   * Format log entry for console with colors
   */
  private formatConsoleEntry(entry: LogEntry): string {
    const colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      green: '\x1b[32m',
      blue: '\x1b[34m',
      gray: '\x1b[90m'
    };

    const levelColors: Record<LogLevel, string> = {
      error: colors.red,
      warn: colors.yellow,
      info: colors.green,
      debug: colors.blue
    };

    const color = levelColors[entry.level];
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const errorStr = entry.error ? `\n  ${entry.error.message}\n  ${entry.error.stack}` : '';
    
    return `${color}[${entry.level.toUpperCase()}]${colors.reset} ${entry.timestamp} ${entry.message}${contextStr}${errorStr}`;
  }

  /**
   * Write log to file
   */
  private writeToFile(entry: LogEntry): void {
    try {
      const logLine = this.formatLogEntry(entry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error
    };

    // Output to console
    console.log(this.formatConsoleEntry(entry));

    // Output to file
    this.writeToFile(entry);
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('error', message, context, error);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Check and rotate log files if they exceed max size
   */
  private startLogRotation(): void {
    setInterval(() => {
      try {
        if (fs.existsSync(this.logFilePath)) {
          const stats = fs.statSync(this.logFilePath);
          
          if (stats.size >= MAX_LOG_SIZE) {
            this.rotateLogs();
          }
        }
      } catch (error) {
        console.error('Failed to check log file size:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Rotate log files
   */
  private rotateLogs(): void {
    try {
      // Remove oldest log if we have too many
      const oldestLog = `${this.logFilePath}.${MAX_LOG_FILES}`;
      if (fs.existsSync(oldestLog)) {
        fs.unlinkSync(oldestLog);
      }

      // Shift existing log files
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const currentLog = i === 1 ? this.logFilePath : `${this.logFilePath}.${i}`;
        const nextLog = `${this.logFilePath}.${i + 1}`;
        
        if (fs.existsSync(currentLog)) {
          fs.renameSync(currentLog, nextLog);
        }
      }

      this.info('Log file rotated', { size: MAX_LOG_SIZE });
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Create HTTP request logging middleware
   */
  static requestMiddleware() {
    const logger = Logger.getInstance();
    
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      // Log request
      const requestLog: RequestLog = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        timestamp: new Date().toISOString()
      };
      
      logger.debug('Incoming request', {
        method: requestLog.method,
        url: requestLog.url,
        headers: requestLog.headers
      });

      // Capture response
      const originalSend = res.send;
      res.send = function(data: any) {
        const duration = Date.now() - startTime;
        
        const responseLog: ResponseLog = {
          statusCode: res.statusCode,
          headers: res.getHeaders ? res.getHeaders() : {},
          body: data,
          duration,
          timestamp: new Date().toISOString()
        };
        
        logger.debug('Outgoing response', {
          statusCode: responseLog.statusCode,
          duration: responseLog.duration
        });
        
        originalSend.call(this, data);
      };

      next();
    };
  }
}

// ============================================
// EXPORTS
// ============================================

/**
 * Get logger instance
 */
export function getLogger(): Logger {
  return Logger.getInstance();
}

/**
 * Log error message
 */
export function logError(message: string, context?: Record<string, unknown>, error?: Error): void {
  getLogger().error(message, context, error);
}

/**
 * Log warning message
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
  getLogger().warn(message, context);
}

/**
 * Log info message
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  getLogger().info(message, context);
}

/**
 * Log debug message
 */
export function logDebug(message: string, context?: Record<string, unknown>): void {
  getLogger().debug(message, context);
}

/**
 * Express middleware for HTTP request/response logging
 */
export { Logger };
export const requestMiddleware = Logger.requestMiddleware;
