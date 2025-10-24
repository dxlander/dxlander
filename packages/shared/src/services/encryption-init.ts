/**
 * Encryption Service Initialization
 *
 * Separate file to avoid circular dependency issues with dynamic imports
 */

import { encryptionService } from './encryption.js'
import { getOrCreateEncryptionKey } from './encryption-key-manager.js'

/**
 * Initialize encryption service with master key from file/env
 * Call this on application startup
 */
export function initializeEncryptionService(): void {
  const masterKey = getOrCreateEncryptionKey()
  encryptionService.setMasterKey(masterKey)
  console.log('✅ Encryption service initialized with master key')
}
