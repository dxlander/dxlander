/**
 * Encryption Key Manager
 *
 * Manages the master encryption key for DXLander
 * - Generates random key on first launch
 * - Stores in ~/.dxlander/encryption.key file
 * - Can be overridden with DXLANDER_ENCRYPTION_KEY environment variable
 * - Used to encrypt ALL credentials in the database
 *
 * Security Best Practices:
 * - Key stored in file system, NOT database
 * - File has restricted permissions (0600 - owner read/write only)
 * - Environment variable takes precedence for production deployments
 * - Key is 32 bytes (256 bits) for AES-256
 */

import { randomBytes } from 'crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Constants
const DXLANDER_HOME = process.env.DXLANDER_HOME || join(homedir(), '.dxlander');
const ENCRYPTION_KEY_FILE = 'encryption.key';
const ENCRYPTION_KEY_PATH = join(DXLANDER_HOME, ENCRYPTION_KEY_FILE);
const KEY_LENGTH = 32; // 256 bits for AES-256
// 32 raw bytes encoded in base64 produce 44 characters, so only base64 keys of length >=44 are accepted
const MIN_KEY_LENGTH = 44;

/**
 * Get or create the master encryption key (synchronous)
 *
 * Priority order:
 * 1. DXLANDER_ENCRYPTION_KEY environment variable (for production/docker)
 * 2. ~/.dxlander/encryption.key file (auto-generated on first launch)
 *
 * @returns {string} Base64-encoded encryption key
 */
export function getOrCreateEncryptionKey(): string {
  // Priority 1: Check environment variable (production deployments)
  if (process.env.DXLANDER_ENCRYPTION_KEY) {
    const envKey = process.env.DXLANDER_ENCRYPTION_KEY;

    // Validate key length for security
    if (envKey.length < MIN_KEY_LENGTH) {
      throw new Error(
        `DXLANDER_ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters long for security (32 raw bytes encoded in base64 produce 44 characters)`
      );
    }

    console.log('✅ Using encryption key from DXLANDER_ENCRYPTION_KEY environment variable');
    return envKey;
  }

  // Priority 2: Check for existing key file
  if (existsSync(ENCRYPTION_KEY_PATH)) {
    console.log(`✅ Using encryption key from ${ENCRYPTION_KEY_PATH}`);
    try {
      const key = readFileSync(ENCRYPTION_KEY_PATH, 'utf8').trim();

      // Validate key length for security
      if (key.length < MIN_KEY_LENGTH) {
        throw new Error(
          `Encryption key in ${ENCRYPTION_KEY_PATH} must be at least ${MIN_KEY_LENGTH} characters long for security (32 raw bytes encoded in base64 produce 44 characters)`
        );
      }

      return key;
    } catch (error: any) {
      console.error(`❌ Failed to read encryption key from ${ENCRYPTION_KEY_PATH}:`, error);
      throw new Error(`Failed to read encryption key: ${error.message}`);
    }
  }

  // Priority 3: Generate new key
  console.log('📝 No encryption key found. Generating new one...');
  return _generateAndSaveEncryptionKey();
}

/**
 * Generate a new random encryption key and save to file
 *
 * @returns {string} Base64-encoded encryption key
 */
function _generateAndSaveEncryptionKey(): string {
  try {
    // Ensure ~/.dxlander directory exists
    if (!existsSync(DXLANDER_HOME)) {
      mkdirSync(DXLANDER_HOME, { recursive: true, mode: 0o700 });
    }

    // Generate random 32-byte key
    const key = randomBytes(KEY_LENGTH).toString('base64');

    // Write to file
    writeFileSync(ENCRYPTION_KEY_PATH, key, {
      encoding: 'utf-8',
      mode: 0o600, // Read/write for owner only
    });

    // Double-check file permissions (some systems ignore mode in writeFileSync)
    try {
      chmodSync(ENCRYPTION_KEY_PATH, 0o600);
    } catch (chmodError) {
      console.warn('⚠️ Could not set file permissions (non-critical):', chmodError);
    }

    console.log(`✅ Generated new encryption key and saved to ${ENCRYPTION_KEY_PATH}`);
    console.log(
      '⚠️  IMPORTANT: Back up this file! Without it, encrypted credentials cannot be recovered.'
    );

    return key;
  } catch (error: any) {
    console.error('❌ Failed to generate encryption key:', error);
    throw new Error(`Failed to create encryption key: ${error.message}`);
  }
}

/**
 * Get the encryption key file path (for documentation/backup purposes)
 *
 * @returns {string} Full path to encryption key file
 */
export function getEncryptionKeyPath(): string {
  return ENCRYPTION_KEY_PATH;
}

/**
 * Check if encryption key exists
 *
 * @returns {boolean} True if key exists (either in env var or file)
 */
export function hasEncryptionKey(): boolean {
  return !!(process.env.DXLANDER_ENCRYPTION_KEY || existsSync(ENCRYPTION_KEY_PATH));
}

/**
 * Backup information for users
 */
export function getBackupInstructions(): string {
  if (process.env.DXLANDER_ENCRYPTION_KEY) {
    return `Your encryption key is set via DXLANDER_ENCRYPTION_KEY environment variable.
Make sure this is backed up in your deployment configuration.`;
  }

  return `Your encryption key is stored at: ${ENCRYPTION_KEY_PATH}

CRITICAL: Back up this file!

To backup:
  cp ${ENCRYPTION_KEY_PATH} /your/backup/location/

To restore:
  cp /your/backup/location/encryption.key ${ENCRYPTION_KEY_PATH}
  chmod 600 ${ENCRYPTION_KEY_PATH}

For production deployments, consider using the environment variable instead:
  export DXLANDER_ENCRYPTION_KEY="$(cat ${ENCRYPTION_KEY_PATH})"`;
}
