import { LogLevel } from '@domain/interfaces/ILogger';

/**
 * Configuration for the logging system
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableDailyRotate: boolean;
  logDirectory: string;
  maxFiles: string;
  maxSize: string;
  format: 'json' | 'simple';
  includeTimestamp: boolean;
  includeTraceId: boolean;
  includeRequestId: boolean;
  includeUserId: boolean;
  enableErrorStack: boolean;
  enablePerformanceLogging: boolean;
}

/**
 * Default logger configuration
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: true,
  enableDailyRotate: true,
  logDirectory: './logs',
  maxFiles: '14d',
  maxSize: '20m',
  format: 'json',
  includeTimestamp: true,
  includeTraceId: true,
  includeRequestId: true,
  includeUserId: true,
  enableErrorStack: true,
  enablePerformanceLogging: true
};

/**
 * Logger configuration manager
 */
export class LoggerConfigManager {
  private static instance: LoggerConfigManager;
  private config: LoggerConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): LoggerConfigManager {
    if (!this.instance) {
      this.instance = new LoggerConfigManager();
    }
    return this.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): LoggerConfig {
    const env = process.env;
    
    return {
      level: (env.LOG_LEVEL as LogLevel) || DEFAULT_LOGGER_CONFIG.level,
      enableConsole: env.LOG_ENABLE_CONSOLE !== 'false',
      enableFile: env.LOG_ENABLE_FILE !== 'false',
      enableDailyRotate: env.LOG_ENABLE_DAILY_ROTATE !== 'false',
      logDirectory: env.LOG_DIRECTORY || DEFAULT_LOGGER_CONFIG.logDirectory,
      maxFiles: env.LOG_MAX_FILES || DEFAULT_LOGGER_CONFIG.maxFiles,
      maxSize: env.LOG_MAX_SIZE || DEFAULT_LOGGER_CONFIG.maxSize,
      format: (env.LOG_FORMAT as 'json' | 'simple') || DEFAULT_LOGGER_CONFIG.format,
      includeTimestamp: env.LOG_INCLUDE_TIMESTAMP !== 'false',
      includeTraceId: env.LOG_INCLUDE_TRACE_ID !== 'false',
      includeRequestId: env.LOG_INCLUDE_REQUEST_ID !== 'false',
      includeUserId: env.LOG_INCLUDE_USER_ID !== 'false',
      enableErrorStack: env.LOG_ENABLE_ERROR_STACK !== 'false',
      enablePerformanceLogging: env.LOG_ENABLE_PERFORMANCE !== 'false'
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Reset to default configuration
   */
  resetToDefault(): void {
    this.config = { ...DEFAULT_LOGGER_CONFIG };
  }

  /**
   * Get log level as string
   */
  getLogLevel(): string {
    return this.config.level;
  }

  /**
   * Check if console logging is enabled
   */
  isConsoleEnabled(): boolean {
    return this.config.enableConsole;
  }

  /**
   * Check if file logging is enabled
   */
  isFileEnabled(): boolean {
    return this.config.enableFile;
  }

  /**
   * Check if daily rotation is enabled
   */
  isDailyRotateEnabled(): boolean {
    return this.config.enableDailyRotate;
  }

  /**
   * Get log directory path
   */
  getLogDirectory(): string {
    return this.config.logDirectory;
  }

  /**
   * Get log format
   */
  getLogFormat(): 'json' | 'simple' {
    return this.config.format;
  }
} 