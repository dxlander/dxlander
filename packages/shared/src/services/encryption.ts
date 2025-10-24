/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption for sensitive credentials.
 * Uses Node.js built-in crypto module (no external dependencies).
 *
 * - Master key generated on first setup or user-provided
 * - Stored in database (encrypted with user passphrase if custom)
 * - All credentials encrypted before storage
 * - Supports key rotation
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync, createHash } from 'crypto'

// Encryption constants
const ALGORITHM = 'aes-256-gcm' as const
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 64
const PBKDF2_ITERATIONS = 310000 // OWASP 2023 recommendation
const HASH_ALGORITHM = 'sha256' as const

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  encrypted: string // Base64
  iv: string // Base64
  authTag: string // Base64
}

/**
 * Master key with metadata
 */
export interface MasterKey {
  key: Buffer
  hash: string
  salt: string
}

/**
 * Encryption Service
 */
export class EncryptionService {
  private masterKey: Buffer | null = null

  /**
   * Generate random master key
   */
  static generateMasterKey(): string {
    return randomBytes(KEY_LENGTH).toString('base64')
  }

  /**
   * Derive key from passphrase using PBKDF2
   */
  static deriveKey(passphrase: string, salt?: Buffer): MasterKey {
    const keySalt = salt || randomBytes(SALT_LENGTH)
    const key = pbkdf2Sync(passphrase, keySalt, PBKDF2_ITERATIONS, KEY_LENGTH, HASH_ALGORITHM)
    const hash = createHash(HASH_ALGORITHM).update(key).digest('hex')

    return {
      key,
      hash,
      salt: keySalt.toString('base64')
    }
  }

  /**
   * Set master key for encryption/decryption
   */
  setMasterKey(masterKey: string): void {
    try {
      this.masterKey = Buffer.from(masterKey, 'base64')
      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes`)
      }
    } catch (error) {
      throw new Error('Invalid master key format')
    }
  }

  /**
   * Get master key hash (for verification)
   */
  getMasterKeyHash(): string {
    if (!this.masterKey) throw new Error('Master key not set')
    return createHash(HASH_ALGORITHM).update(this.masterKey).digest('hex')
  }

  /**
   * Encrypt string with AES-256-GCM
   */
  encrypt(plaintext: string): EncryptedData {
    if (!this.masterKey) throw new Error('Master key not set')

    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64')
    }
  }

  /**
   * Decrypt AES-256-GCM encrypted data
   */
  decrypt(encryptedData: EncryptedData): string {
    if (!this.masterKey) throw new Error('Master key not set')

    try {
      const iv = Buffer.from(encryptedData.iv, 'base64')
      const authTag = Buffer.from(encryptedData.authTag, 'base64')
      const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv)

      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      throw new Error('Decryption failed: invalid data or wrong key')
    }
  }

  /**
   * Encrypt object (converts to JSON)
   */
  encryptObject<T>(obj: T): EncryptedData {
    return this.encrypt(JSON.stringify(obj))
  }

  /**
   * Decrypt object (parses JSON)
   */
  decryptObject<T>(encryptedData: EncryptedData): T {
    const json = this.decrypt(encryptedData)
    try {
      return JSON.parse(json) as T
    } catch {
      throw new Error('Decrypted data is not valid JSON')
    }
  }

  /**
   * Compact storage format: iv:authTag:encrypted
   */
  encryptForStorage(plaintext: string): string {
    const { iv, authTag, encrypted } = this.encrypt(plaintext)
    return `${iv}:${authTag}:${encrypted}`
  }

  /**
   * Decrypt from compact storage format
   */
  decryptFromStorage(compactEncrypted: string): string {
    const parts = compactEncrypted.split(':')
    if (parts.length !== 3) throw new Error('Invalid encrypted data format')

    const [iv, authTag, encrypted] = parts
    return this.decrypt({ iv, authTag, encrypted })
  }

  /**
   * Encrypt object for storage
   */
  encryptObjectForStorage<T>(obj: T): string {
    return this.encryptForStorage(JSON.stringify(obj))
  }

  /**
   * Decrypt object from storage
   */
  decryptObjectFromStorage<T>(compactEncrypted: string): T {
    const json = this.decryptFromStorage(compactEncrypted)
    try {
      return JSON.parse(json) as T
    } catch {
      throw new Error('Decrypted data is not valid JSON')
    }
  }

  /**
   * Re-encrypt with new key (for rotation)
   */
  reencrypt(encryptedData: EncryptedData, newMasterKey: string): EncryptedData {
    const plaintext = this.decrypt(encryptedData)
    const oldKey = this.masterKey
    this.setMasterKey(newMasterKey)
    const newEncrypted = this.encrypt(plaintext)
    this.masterKey = oldKey
    return newEncrypted
  }
}

/**
 * Utility functions
 */
export const EncryptionUtils = {
  generateKey: () => EncryptionService.generateMasterKey(),

  deriveFromPassphrase: (passphrase: string, salt?: string): MasterKey => {
    const saltBuffer = salt ? Buffer.from(salt, 'base64') : undefined
    return EncryptionService.deriveKey(passphrase, saltBuffer)
  },

  verifyPassphrase: (passphrase: string, salt: string, expectedHash: string): boolean => {
    const { hash } = EncryptionService.deriveKey(passphrase, Buffer.from(salt, 'base64'))
    return hash === expectedHash
  },

  hashKey: (key: string): string => {
    const keyBuffer = Buffer.from(key, 'base64')
    return createHash(HASH_ALGORITHM).update(keyBuffer).digest('hex')
  },

  validateKey: (key: string): boolean => {
    try {
      const keyBuffer = Buffer.from(key, 'base64')
      return keyBuffer.length === KEY_LENGTH
    } catch {
      return false
    }
  },

  generateSecureId: (length = 32): string => randomBytes(length).toString('hex')
}

/**
 * Singleton instance
 */
export const encryptionService = new EncryptionService()
