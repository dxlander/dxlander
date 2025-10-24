// Mock data for UI development
// This file contains realistic mock data for testing the analysis and config UI

export interface ActivityLogEntry {
  id: string
  timestamp: Date
  action: string
  status: 'pending' | 'in_progress' | 'complete' | 'error'
  result?: string
  details?: string[]
  fileName?: string
  duration?: number
}

export interface AnalysisResults {
  framework: {
    name: string
    version: string
    type?: string
    confidence: number
    detectedFrom: string[]
  }
  language: {
    primary: string
    breakdown: Record<string, number>
    files: Record<string, number>
  }
  runtime: {
    name: string
    version: string
    detectedFrom: string[]
  }
  packageManager: {
    name: string
    version?: string
    detectedFrom: string[]
  }
  buildTools: Array<{
    name: string
    version?: string
    enabled?: boolean
    detectedFrom: string[]
  }>
  dependencies: {
    production: Array<{
      name: string
      version: string
      size?: string
      risk?: string
    }>
    development: Array<{
      name: string
      version: string
      size?: string
      risk?: string
    }>
    totalCount: number
    totalSize?: string
  }
  security: {
    vulnerabilities: {
      critical: number
      high: number
      moderate: number
      low: number
    }
    notices: Array<{
      severity: string
      package: string
      version: string
      issue: string
      recommendation: string
      cvss?: number
    }>
  }
  buildConfig: {
    buildCommand: string
    startCommand: string
    devCommand?: string
    testCommand?: string
    port: number
    outputDirectory: string
    publicDirectory?: string
    nodeVersion?: string
  }
  environmentVariables: Array<{
    key: string
    required: boolean
    type: string
    description: string
    example: string
    detectedIn: string[]
    usedIn: string[]
    feature?: string
  }>
  fileAnalysis: Array<{
    file: string
    type: string
    insights: string[]
  }>
  recommendations: {
    excellent: Array<{
      title: string
      description: string
      impact: string
    }>
    improvements: Array<{
      title: string
      description: string
      impact: string
      difficulty?: string
      estimatedTime?: string
      code?: string
    }>
    deployment: Array<{
      title: string
      description: string
      impact: string
      implemented?: boolean
    }>
  }
}

// Mock activity log for analysis
export const mockActivityLog: ActivityLogEntry[] = [
  {
    id: '1',
    timestamp: new Date('2025-10-09T14:45:10Z'),
    action: 'Scanned project directory',
    status: 'complete',
    result: 'Found 87 files, 2.3 MB total',
    details: ['Text files: 87', 'Binary files: 0 (skipped)', 'Directories: 12'],
    duration: 800
  },
  {
    id: '2',
    timestamp: new Date('2025-10-09T14:45:11Z'),
    action: 'Identified project structure',
    status: 'complete',
    result: 'Monorepo detected',
    details: [
      'Type: pnpm workspaces',
      'Root: /apps/web, /apps/api',
      'Packages: /packages/shared, /packages/ui'
    ],
    duration: 500
  },
  {
    id: '3',
    timestamp: new Date('2025-10-09T14:45:12Z'),
    action: 'Analyzed package.json',
    status: 'complete',
    result: 'Next.js 14.2.0',
    details: [
      'Framework: Next.js 14.2.0',
      'Dependencies: 47 production, 23 development',
      'Scripts: dev, build, start, lint, test, typecheck',
      'Package Manager: pnpm 8.15.0'
    ],
    fileName: 'package.json',
    duration: 1200
  },
  {
    id: '4',
    timestamp: new Date('2025-10-09T14:45:13Z'),
    action: 'Detected TypeScript configuration',
    status: 'complete',
    result: 'Strict mode enabled',
    details: [
      'Config: tsconfig.json with strict: true',
      'Path aliases: @/*, @/components/*, @/lib/*',
      'JSX: preserve mode',
      'Module resolution: bundler'
    ],
    fileName: 'tsconfig.json',
    duration: 600
  },
  {
    id: '5',
    timestamp: new Date('2025-10-09T14:45:14Z'),
    action: 'Analyzed next.config.js',
    status: 'complete',
    result: 'App Router with Turbopack',
    details: [
      'App Router: Using /app directory',
      'Experimental: turbopack enabled',
      'Image optimization: configured',
      'Redirects: 3 rules defined'
    ],
    fileName: 'next.config.js',
    duration: 900
  },
  {
    id: '6',
    timestamp: new Date('2025-10-09T14:45:15Z'),
    action: 'Scanned dependencies',
    status: 'complete',
    result: '70 packages total',
    details: [
      'Production: 47 packages',
      'Development: 23 packages',
      'Vulnerabilities: 1 moderate in dev deps',
      'Outdated: 3 packages have updates available'
    ],
    duration: 2100
  },
  {
    id: '7',
    timestamp: new Date('2025-10-09T14:45:17Z'),
    action: 'Identified environment variables',
    status: 'complete',
    result: '8 variables detected',
    details: [
      'Required: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL',
      'Optional: STRIPE_SECRET_KEY, SENDGRID_API_KEY, AWS_S3_BUCKET, REDIS_URL, OPENAI_API_KEY',
      'Sources: .env.example, code analysis'
    ],
    duration: 1800
  },
  {
    id: '8',
    timestamp: new Date('2025-10-09T14:45:19Z'),
    action: 'Analyzed database schema',
    status: 'complete',
    result: 'PostgreSQL with Prisma',
    details: [
      'Provider: PostgreSQL',
      'ORM: Prisma 5.10.0',
      'Models: 12 (User, Product, Order, ...)',
      'Migrations: 15 migration files',
      'Indexes: 23 for optimization'
    ],
    fileName: 'prisma/schema.prisma',
    duration: 1400
  }
]

// Mock analysis results
export const mockAnalysisResults: AnalysisResults = {
  framework: {
    name: 'Next.js',
    version: '14.2.0',
    type: 'app-router',
    confidence: 98,
    detectedFrom: ['package.json', 'next.config.js', 'app directory structure']
  },
  language: {
    primary: 'TypeScript',
    breakdown: {
      'TypeScript': 87.3,
      'JavaScript': 10.2,
      'JSON': 2.3,
      'CSS': 0.2
    },
    files: {
      'TypeScript': 76,
      'JavaScript': 9,
      'JSON': 2,
      'CSS': 0
    }
  },
  runtime: {
    name: 'Node.js',
    version: '>=18.0.0',
    detectedFrom: ['package.json engines field']
  },
  packageManager: {
    name: 'pnpm',
    version: '8.15.0',
    detectedFrom: ['pnpm-lock.yaml', 'package.json packageManager field']
  },
  buildTools: [
    { name: 'Turbopack', enabled: true, detectedFrom: ['next.config.js experimental.turbo'] },
    { name: 'PostCSS', version: '8.4.0', detectedFrom: ['package.json devDependencies'] },
    { name: 'TailwindCSS', version: '4.0.0', detectedFrom: ['tailwind.config.ts'] }
  ],
  dependencies: {
    production: [
      { name: 'next', version: '14.2.0', size: '2.3 MB', risk: 'low' },
      { name: 'react', version: '18.3.0', size: '324 KB', risk: 'low' },
      { name: 'react-dom', version: '18.3.0', size: '1.8 MB', risk: 'low' },
      { name: '@prisma/client', version: '5.10.0', size: '4.2 MB', risk: 'low' },
      { name: 'next-auth', version: '5.0.0', size: '892 KB', risk: 'low' },
      { name: 'stripe', version: '14.18.0', size: '3.1 MB', risk: 'low' },
      { name: 'zod', version: '3.22.4', size: '234 KB', risk: 'low' }
    ],
    development: [
      { name: 'typescript', version: '5.4.0', size: '67 MB', risk: 'low' },
      { name: '@types/node', version: '20.11.0', size: '4.8 MB', risk: 'low' },
      { name: '@types/react', version: '18.2.55', size: '3.2 MB', risk: 'low' },
      { name: 'eslint', version: '8.56.0', size: '14 MB', risk: 'low' },
      { name: 'prisma', version: '5.10.0', size: '78 MB', risk: 'low' }
    ],
    totalCount: 70,
    totalSize: '245 MB'
  },
  security: {
    vulnerabilities: {
      critical: 0,
      high: 0,
      moderate: 1,
      low: 0
    },
    notices: [
      {
        severity: 'moderate',
        package: 'babel-loader',
        version: '9.1.0',
        issue: 'Prototype Pollution vulnerability',
        recommendation: 'Upgrade to version 9.1.3 or later',
        cvss: 5.3
      }
    ]
  },
  buildConfig: {
    buildCommand: 'pnpm build',
    startCommand: 'pnpm start',
    devCommand: 'pnpm dev',
    testCommand: 'pnpm test',
    port: 3000,
    outputDirectory: '.next',
    publicDirectory: 'public',
    nodeVersion: '18.x'
  },
  environmentVariables: [
    {
      key: 'DATABASE_URL',
      required: true,
      type: 'connection_string',
      description: 'PostgreSQL database connection string',
      example: 'postgresql://user:password@localhost:5432/dbname',
      detectedIn: ['prisma/schema.prisma', '.env.example'],
      usedIn: ['lib/db.ts', 'prisma migrations']
    },
    {
      key: 'NEXTAUTH_SECRET',
      required: true,
      type: 'secret',
      description: 'NextAuth.js secret key for encryption (min 32 characters)',
      example: 'Run: openssl rand -base64 32',
      detectedIn: ['app/api/auth/[...nextauth]/route.ts', '.env.example'],
      usedIn: ['authentication', 'session management']
    },
    {
      key: 'NEXTAUTH_URL',
      required: true,
      type: 'url',
      description: 'Public URL of your application',
      example: 'https://yourdomain.com',
      detectedIn: ['next-auth.config.ts'],
      usedIn: ['OAuth callbacks', 'email magic links']
    },
    {
      key: 'STRIPE_SECRET_KEY',
      required: false,
      type: 'api_key',
      description: 'Stripe API key for payment processing',
      example: 'sk_test_...',
      detectedIn: ['app/api/checkout/route.ts', '.env.example'],
      usedIn: ['payment processing', 'subscription management'],
      feature: 'Payments'
    }
  ],
  fileAnalysis: [
    {
      file: 'package.json',
      type: 'config',
      insights: [
        'Framework: Next.js 14.2.0 detected',
        'Package Manager: pnpm (from packageManager field and pnpm-lock.yaml)',
        'Scripts: 6 scripts defined (dev, build, start, lint, test, typecheck)',
        'Dependencies: 47 production, 23 development',
        'Engine: Node.js >=18.0.0 required'
      ]
    },
    {
      file: 'next.config.js',
      type: 'config',
      insights: [
        'App Router: Using /app directory (not /pages)',
        'Experimental: Turbopack enabled for faster builds',
        'Image Optimization: Custom domains configured',
        'Environment Variables: Loaded from .env.local',
        'Redirects: 3 redirect rules defined'
      ]
    }
  ],
  recommendations: {
    excellent: [
      {
        title: 'TypeScript with Strict Mode',
        description: 'Reduces runtime errors and improves code quality',
        impact: 'high'
      },
      {
        title: 'Monorepo Structure',
        description: 'Good separation of concerns with /apps and /packages',
        impact: 'medium'
      }
    ],
    improvements: [
      {
        title: 'Add Health Check Endpoint',
        description: 'Create /api/health for Docker health checks and monitoring',
        impact: 'medium',
        difficulty: 'easy',
        estimatedTime: '15 minutes',
        code: `// app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
}`
      }
    ],
    deployment: [
      {
        title: 'Use Multi-Stage Docker Build',
        description: 'Reduces final image size by 60-70%',
        impact: 'high',
        implemented: true
      }
    ]
  }
}

// Mock files being analyzed
export const mockFilesAnalyzed = [
  { name: 'package.json', status: 'complete' as const },
  { name: 'tsconfig.json', status: 'complete' as const },
  { name: 'next.config.js', status: 'complete' as const },
  { name: 'tailwind.config.ts', status: 'complete' as const },
  { name: '.env.example', status: 'complete' as const },
  { name: 'README.md', status: 'analyzing' as const },
  { name: 'docker-compose.yml', status: 'pending' as const },
  { name: 'Dockerfile', status: 'pending' as const },
  { name: '.dockerignore', status: 'pending' as const }
]
