// Server-only utility functions (uses Node.js crypto)
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

/**
 * Generate a cryptographically secure unique ID
 * Uses nanoid which is more efficient and collision-resistant than custom implementations
 */
export function generateId(): string {
  return nanoid();
}

export function createContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
