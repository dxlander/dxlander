// Server-only utility functions (uses Node.js crypto)
import { createHash, randomBytes } from 'crypto';

export function generateId(): string {
  // Use cryptographically secure random bytes for collision resistance
  return createHash('sha256').update(randomBytes(32)).digest('hex').substring(0, 16);
}

export function createContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
