/**
 * Centralized logging utility
 * In production, only errors are logged. Debug logs are suppressed.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Debug-level logging - only shown in development
   */
  debug: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info-level logging - only shown in development
   */
  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Warning-level logging - shown in all environments
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * Error-level logging - shown in all environments
   */
  error: (message: string, error?: Error | unknown, ...args: any[]) => {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, error.message, error.stack, ...args);
    } else {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  },
};
