export const APP_NAME = 'DXLander';
export const APP_VERSION = '0.1.0';

export const DEFAULT_PORT = 3000;
export const API_PORT = 3001;

export const SUPPORTED_FRAMEWORKS = [
  'nextjs',
  'nuxtjs',
  'react',
  'vue',
  'angular',
  'svelte',
  'express',
  'fastify',
  'nestjs',
  'django',
  'flask',
  'rails',
  'laravel',
  'spring-boot',
  'go-gin',
  'rust-axum',
] as const;

export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'go',
  'rust',
  'java',
  'php',
  'ruby',
  'csharp',
] as const;

export const DEPLOYMENT_PLATFORMS = [
  'vercel',
  'railway',
  'render',
  'fly-io',
  'netlify',
  'digitalocean-apps',
  'aws-ecs',
  'google-cloud-run',
  'heroku',
  'self-hosted',
] as const;

export const INTEGRATION_SERVICES = [
  'supabase',
  'firebase',
  'mongodb-atlas',
  'planetscale',
  'auth0',
  'clerk',
  'nextauth',
  'aws-s3',
  'cloudinary',
  'uploadthing',
  'stripe',
  'sendgrid',
  'twilio',
  'openai',
  'google-analytics',
  'mixpanel',
  'posthog',
] as const;

export const FILE_SIZE_LIMITS = {
  SINGLE_FILE: 10 * 1024 * 1024, // 10MB
  PROJECT_TOTAL: 100 * 1024 * 1024, // 100MB
  ZIP_FILE: 50 * 1024 * 1024, // 50MB
} as const;

export const CACHE_DURATIONS = {
  ANALYSIS_RESULT: 24 * 60 * 60 * 1000, // 24 hours
  GITHUB_REPO: 60 * 60 * 1000, // 1 hour
  INTEGRATION_CHECK: 30 * 60 * 1000, // 30 minutes
} as const;

export const AI_MODELS = {
  OPENAI: {
    ANALYSIS: 'gpt-4-turbo-preview',
    CONFIG_GEN: 'gpt-4',
  },
  ANTHROPIC: {
    ANALYSIS: 'claude-3-sonnet-20240229',
    CONFIG_GEN: 'claude-3-haiku-20240307',
  },
} as const;

/**
 * Supported AI Providers
 */
export const AI_PROVIDERS = [
  'claude-code',
  'openai',
  'ollama',
  'lmstudio',
  'anthropic',
  'openrouter',
  'groq',
] as const;

/**
 * AI Provider Timeout Configuration (in milliseconds)
 */
export const AI_PROVIDER_TIMEOUTS = {
  INITIALIZATION: 15000, // 15 seconds
  MODEL_FETCH: 15000, // 15 seconds
  CONNECTION_TEST: 10000, // 10 seconds
  ANALYSIS: 300000, // 5 minutes
} as const;
