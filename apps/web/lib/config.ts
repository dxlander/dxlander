export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  debug: process.env.NEXT_PUBLIC_DEBUG === 'true',

  app: {
    name: 'DXLander',
    version: '0.1.0',
  },
} as const;

export function validateConfig() {
  const required: string[] = [];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

if (process.env.NODE_ENV === 'development') {
  try {
    validateConfig();
  } catch (error) {
    console.warn('⚠️  Environment variable warning:', error);
  }
}
