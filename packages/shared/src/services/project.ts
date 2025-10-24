import { createHash } from 'crypto'

export interface ProjectAnalysisInput {
  projectId: string
  files: Map<string, string>
  repoInfo?: {
    owner: string
    repo: string
    branch: string
    language?: string
    description?: string
    topics?: string[]
  }
}

/**
 * Generate a unique hash for project source
 * Used for duplicate detection
 */
export function generateSourceHash(sourceUrl: string, branch?: string): string {
  const input = `${sourceUrl}:${branch || 'default'}`
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Validate project name (optional - will generate random name if not provided)
 */
export function validateProjectName(name?: string): { valid: boolean; error?: string } {
  // Name is optional - will be generated if not provided
  if (!name || name.trim().length === 0) {
    return { valid: true }
  }

  if (name.length > 100) {
    return { valid: false, error: 'Project name must be less than 100 characters' }
  }

  // Allow alphanumeric, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return { valid: false, error: 'Project name can only contain letters, numbers, spaces, hyphens, and underscores' }
  }

  return { valid: true }
}

/**
 * Generate a random project name like hosting platforms do
 * Format: adjective-noun-number (e.g., uncanny-john-23545)
 */
export function generateRandomProjectName(): string {
  const adjectives = [
    'autumn', 'hidden', 'bitter', 'misty', 'silent', 'empty', 'dry', 'dark',
    'summer', 'icy', 'delicate', 'quiet', 'white', 'cool', 'spring', 'winter',
    'patient', 'twilight', 'dawn', 'crimson', 'wispy', 'weathered', 'blue',
    'billowing', 'broken', 'cold', 'damp', 'falling', 'frosty', 'green',
    'long', 'late', 'lingering', 'bold', 'little', 'morning', 'muddy', 'old',
    'red', 'rough', 'still', 'small', 'sparkling', 'throbbing', 'shy',
    'wandering', 'withered', 'wild', 'black', 'young', 'holy', 'solitary',
    'fragrant', 'aged', 'snowy', 'proud', 'floral', 'restless', 'divine',
    'polished', 'ancient', 'purple', 'lively', 'nameless', 'lucky', 'odd',
    'untamed', 'tender', 'shiny', 'fancy', 'swift', 'rapid', 'uncanny'
  ]

  const nouns = [
    'waterfall', 'river', 'breeze', 'moon', 'rain', 'wind', 'sea', 'morning',
    'snow', 'lake', 'sunset', 'pine', 'shadow', 'leaf', 'dawn', 'glitter',
    'forest', 'hill', 'cloud', 'meadow', 'sun', 'glade', 'bird', 'brook',
    'butterfly', 'bush', 'dew', 'dust', 'field', 'fire', 'flower', 'firefly',
    'feather', 'grass', 'haze', 'mountain', 'night', 'pond', 'darkness',
    'snowflake', 'silence', 'sound', 'sky', 'shape', 'surf', 'thunder',
    'violet', 'water', 'wildflower', 'wave', 'water', 'resonance', 'sun',
    'wood', 'dream', 'cherry', 'tree', 'fog', 'frost', 'voice', 'paper',
    'frog', 'smoke', 'star', 'john', 'mary', 'peter', 'paul', 'susan'
  ]

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(10000 + Math.random() * 90000) // 5-digit number

  return `${adjective}-${noun}-${number}`
}
