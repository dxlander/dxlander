// Server-only utility functions (uses Node.js crypto)
import { createHash } from 'crypto';

export function generateId(): string {
  return createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 16);
}

export function createContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
