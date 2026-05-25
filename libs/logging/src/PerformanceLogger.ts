import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from './LoggerFactory';

/**
 * Performance measurement interface
 */
export interface PerformanceMeasurement {
  operation: string;
  duration: number;
  startTime: number;
  endTime: number;
  context?: Record<string, any>;
}

/**
 * Performance logger for measuring operation performance
 * Provides methods for timing operations and logging performance metrics
 */
export class PerformanceLogger {
  private logger: ILogger;
  private measurements: Map<string, PerformanceMeasurement> = new Map();

  constructor() {
    this.logger = LoggerFactory.getInstance().createPerformanceLogger();
  }

  /**
   * Start timing an operation
   * @param operation - Name of the operation to time
   * @param context - Optional context for the operation
   * @returns Operation ID for tracking
   */
  startTimer(operation: string, context?: Record<string, any>): string {
    const operationId = this.generateOperationId(operation);
    const startTime = Date.now();

    this.measurements.set(operationId, {
      operation,
      duration: 0,
      startTime,
      endTime: 0,
      context
    });

    this.logger.debug(`Started timing operation: ${operation}`, {
      operationId,
      operation,
      startTime,
      context
    });

    return operationId;
  }

  /**
   * End timing an operation
   * @param operationId - Operation ID returned from startTimer
   * @param additionalContext - Additional context to log
   */
  endTimer(operationId: string, additionalContext?: Record<string, any>): PerformanceMeasurement | null {
    const measurement = this.measurements.get(operationId);
    if (!measurement) {
      this.logger.warn(`Attempted to end timer for unknown operation: ${operationId}`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - measurement.startTime;

    const finalMeasurement: PerformanceMeasurement = {
      ...measurement,
      endTime,
      duration,
      context: {
        ...measurement.context,
        ...additionalContext
      }
    };

    this.measurements.set(operationId, finalMeasurement);

    // Log performance metrics
    this.logPerformance(operationId, finalMeasurement);

    return finalMeasurement;
  }

  /**
   * Time an operation using a callback
   * @param operation - Name of the operation
   * @param callback - Function to execute and time
   * @param context - Optional context
   * @returns Promise with the result and performance measurement
   */
  async timeOperation<T>(
    operation: string,
    callback: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<{ result: T; measurement: PerformanceMeasurement }> {
    const operationId = this.startTimer(operation, context);
    
    try {
      const result = await callback();
      const measurement = this.endTimer(operationId, { success: true });
      
      return {
        result,
        measurement: measurement!
      };
    } catch (error) {
      this.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Time a synchronous operation
   * @param operation - Name of the operation
   * @param callback - Function to execute and time
   * @param context - Optional context
   * @returns Result and performance measurement
   */
  timeSyncOperation<T>(
    operation: string,
    callback: () => T,
    context?: Record<string, any>
  ): { result: T; measurement: PerformanceMeasurement } {
    const operationId = this.startTimer(operation, context);
    
    try {
      const result = callback();
      const measurement = this.endTimer(operationId, { success: true });
      
      return {
        result,
        measurement: measurement!
      };
    } catch (error) {
      this.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Log performance metrics
   * @param operationId - Operation ID
   * @param measurement - Performance measurement
   */
  private logPerformance(operationId: string, measurement: PerformanceMeasurement): void {
    const { operation, duration, context } = measurement;

    // Determine log level based on duration
    let logLevel: 'debug' | 'info' | 'warn' = 'debug';
    if (duration > 1000) {
      logLevel = 'warn';
    } else if (duration > 100) {
      logLevel = 'info';
    }

    const logContext = {
      operationId,
      operation,
      duration,
      durationMs: `${duration}ms`,
      startTime: new Date(measurement.startTime).toISOString(),
      endTime: new Date(measurement.endTime).toISOString(),
      ...context
    };

    switch (logLevel) {
      case 'warn':
        this.logger.warn(`Slow operation detected: ${operation} took ${duration}ms`, logContext);
        break;
      case 'info':
        this.logger.info(`Operation completed: ${operation} took ${duration}ms`, logContext);
        break;
      default:
        this.logger.debug(`Operation completed: ${operation} took ${duration}ms`, logContext);
    }
  }

  /**
   * Get all measurements
   * @returns Map of all performance measurements
   */
  getMeasurements(): Map<string, PerformanceMeasurement> {
    return new Map(this.measurements);
  }

  /**
   * Get measurement by operation ID
   * @param operationId - Operation ID
   * @returns Performance measurement or null
   */
  getMeasurement(operationId: string): PerformanceMeasurement | null {
    return this.measurements.get(operationId) || null;
  }

  /**
   * Clear all measurements
   */
  clearMeasurements(): void {
    this.measurements.clear();
  }

  /**
   * Get summary statistics
   * @returns Summary of all measurements
   */
  getSummary(): {
    totalOperations: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    slowOperations: PerformanceMeasurement[];
  } {
    const measurements = Array.from(this.measurements.values());
    
    if (measurements.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowOperations: []
      };
    }

    const durations = measurements.map(m => m.duration);
    const averageDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const slowOperations = measurements.filter(m => m.duration > 1000);

    return {
      totalOperations: measurements.length,
      averageDuration,
      minDuration,
      maxDuration,
      slowOperations
    };
  }

  /**
   * Generate unique operation ID
   * @param operation - Operation name
   * @returns Unique operation ID
   */
  private generateOperationId(operation: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${operation}_${timestamp}_${random}`;
  }
} 