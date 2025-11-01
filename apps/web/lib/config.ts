/**
 * Frontend Configuration
 * Centralized configuration for all environment variables
 *
 * IMPORTANT: Only variables prefixed with NEXT_PUBLIC_ are available in the browser
 */

export const config = {
  /**
   * API Base URL
   * Points to the Hono backend server
   */
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  /**
   * Debug mode
   * Enables verbose logging and development features
   */
  debug: process.env.NEXT_PUBLIC_DEBUG === 'true',

  /**
   * App Information
   */
  app: {
    name: 'DXLander',
    version: '0.1.0',
  },
} as const;

/**
 * Validate required environment variables
 * Throws an error if any required variables are missing
 */
export function validateConfig() {
  // NEXT_PUBLIC_API_URL has a default value, so it's not actually required
  // Only validate variables that don't have defaults and are truly required
  const required: string[] = [];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate on import (fails fast in development)
if (process.env.NODE_ENV === 'development') {
  try {
    validateConfig();
  } catch (error) {
    console.warn('⚠️  Environment variable warning:', error);
  }
}
