/**
 * AI Prompt Management
 *
 * Centralized prompt templates for all AI providers.
 * This ensures consistent results regardless of which AI service is used.
 *
 * WHY THIS EXISTS:
 * - Single source of truth for prompts
 * - Easy to update and maintain
 * - Consistent across all providers
 * - Version-controllable
 */

import type { ProjectContext, ProjectAnalysisResult, DeploymentConfigRequest } from '../types';

/**
 * System prompts for different AI capabilities
 */
export const SystemPrompts = {
  /**
   * General coding assistant
   */
  coding: `You are an expert software engineer with deep knowledge of:
- Modern web frameworks (React, Next.js, Vue, Svelte)
- Backend frameworks (Express, FastAPI, Django, Rails)
- Database systems (PostgreSQL, MySQL, MongoDB, Redis)
- DevOps and deployment (Docker, Kubernetes, CI/CD)
- Cloud platforms (AWS, GCP, Azure, Vercel, Railway)

Provide accurate, production-ready solutions.`,

  /**
   * Project analysis specialist
   */
  projectAnalysis: `You are an expert DevOps engineer and project analyst.

CRITICAL RULES FOR TOOL-CALLING MODE:
1. You have a MAXIMUM of 25 steps - plan your exploration wisely
2. Use tools (readFile, listDirectory, globFind, grepSearch) to explore the project
3. DO NOT output any text while exploring - only use tools silently
4. Reserve your LAST step to output the final JSON result
5. Your FINAL output must be PURE JSON starting with { and ending with }
6. NO thinking text, NO explanations, NO markdown - ONLY the final JSON object

STRATEGY: Use ~20 steps for exploration, then output JSON in your final step. Do not use all 25 steps for tools!`,

  /**
   * Configuration generation specialist
   */
  configGeneration: `You are a DevOps expert specializing in Docker, Kubernetes, and CI/CD.

CRITICAL RULES FOR TOOL-CALLING MODE:
1. You have a MAXIMUM of 25 steps - plan your file creation wisely
2. Use the writeFile tool to create configuration files
3. DO NOT output any text while writing files - work SILENTLY
4. You MUST create a _summary.json file as the LAST file you write
5. After writing all files (including _summary.json), output a brief JSON confirmation
6. NO thinking text, NO explanations during file creation

STRATEGY: Write all config files first, then _summary.json, then output confirmation. Reserve your last step for output!`,
} as const;

/**
 * Build project analysis prompt
 */
export function buildProjectAnalysisPrompt(context: ProjectContext): string {
  const hasReadme = context.readme !== undefined;

  return `
You are an expert DevOps engineer and polyglot programmer. Analyze this project and determine its structure, language, framework, dependencies, and deployment requirements.

**YOUR MISSION:**
Explore and understand this project. Determine:
- What is it? (web app, API, CLI tool, library, monorepo, etc.)
- What language(s) and framework(s)?
- How to build and run it?
- What services does it use?
- What configuration does it need?

**TOOLS AT YOUR DISPOSAL:**
- **Glob**: Find files by pattern (\`**/*.py\`, \`**/Cargo.toml\`, etc.)
- **Read**: Read any file
- **Grep**: Search for patterns in code

**PRIORITY FILES - READ THESE FIRST:**
1. **README.md / README** - Project overview, setup instructions, environment variables, deployment notes
2. **docs/ or documentation/ folder** - Architecture docs, API docs, deployment guides (.md files)
3. **Existing Dockerfile / docker-compose.yml** - CRITICAL: Shows original author's deployment intent
4. **Manifest files** - package.json, requirements.txt, go.mod, Cargo.toml for dependencies
5. **.env.example / .env.sample** - Required environment variables
6. **Config files** - Configuration revealing integrations, databases, external services

**STRATEGIC APPROACH:**
You have a MAXIMUM of 25 steps. Use ~20 for exploration, then OUTPUT JSON in your final step:

1. **Start with high-signal files**: README, manifest files, and existing Docker configs contain the most critical information about a project's tech stack, build process, and architecture.

2. **Check for existing Docker files**: If Dockerfile or docker-compose.yml exists, READ IT CAREFULLY - it shows how the author intended deployment and reveals service dependencies.

3. **Read documentation**: Look for README.md, docs/*.md, DEPLOYMENT.md, CONTRIBUTING.md - these often contain crucial setup and configuration information.

4. **Infer before reading everything**: If you find a manifest file that clearly lists dependencies and build commands, you may not need to read every source file. Make informed conclusions.

5. **Use Glob strategically**: One well-crafted glob pattern can reveal more than multiple individual file reads. Look for patterns that indicate project structure.

6. **Avoid redundancy**: If multiple files serve the same purpose (e.g., several config files of the same type), reading one representative sample may be sufficient.

7. **Think hierarchically**: In monorepos or multi-service projects, identify the structure first (workspace root, service directories), then analyze key components rather than every detail.

8. **Let evidence guide you**: Each file you read should inform your next action. If a file confirms Node.js, focus on Node.js-specific patterns rather than checking for every possible language.

${hasReadme ? `**README AVAILABLE:**\n\`\`\`\n${context.readme}\n\`\`\`\n\n` : ''}

---

**OUTPUT FORMAT:**

Return a JSON object with this structure:

\`\`\`json
{
  "summary": {
    "overview": "A brief 2-3 sentence summary of what this project is and does",
    "purpose": "What problem does this solve? What is it used for?",
    "deployable": true,
    "deploymentNotes": "Deployment considerations (e.g., 'This is a library, not meant for direct deployment' or 'Production-ready web application')"
  },
  "frameworks": [
    {
      "name": "Framework name (e.g., Next.js, Express, FastAPI, Django)",
      "version": "Version if detected",
      "type": "frontend | backend | fullstack | mobile | desktop | cli",
      "confidence": 95,
      "evidence": ["Specific files/patterns that led to this conclusion"]
    }
  ],
  "language": {
    "primary": "Primary language",
    "breakdown": {
      "Language1": 70,
      "Language2": 20,
      "Other": 10
    }
  },
  "projectType": "monorepo | single-app | library | cli-tool | microservices",
  "projectStructure": {
    "rootDirectory": "Path to project root",
    "sourceDirectory": "Main source code directory (e.g., src/, app/, lib/)",
    "configFiles": ["List of important config files found"],
    "entryPoints": ["Main entry point files"],
    "hasTests": true,
    "testDirectory": "tests/ or __tests__/ if found",
    "hasDocumentation": true,
    "documentationFiles": ["README.md", "docs/"]
  },
  "dependencies": {
    "production": [
      {"name": "pkg-name", "version": "1.0.0", "purpose": "Brief description"}
    ],
    "development": [
      {"name": "dev-pkg", "version": "1.0.0", "purpose": "Brief description"}
    ],
    "totalCount": 45,
    "outdatedWarnings": ["Packages that might be outdated"]
  },
  "integrations": [
    // ONLY external services requiring credentials (API keys, tokens, connection strings)
    // DO NOT include: localStorage, Icons, icon libraries, browser APIs, packages without external APIs
    {
      "name": "Supabase",
      "service": "supabase",
      "type": "database",
      "confidence": 95,
      "requiredKeys": ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
      "optionalKeys": ["SUPABASE_SERVICE_ROLE_KEY"],
      "detectedFrom": "Found in .env.example, package.json (@supabase/supabase-js), and src/lib/supabase.ts",
      "files": ["src/lib/supabase.ts", "src/hooks/useAuth.ts"],
      "credentialType": "multiple",
      "requiresSignup": true,
      "optional": false
    },
    {
      "name": "Stripe Payments",
      "service": "stripe",
      "type": "payment",
      "confidence": 90,
      "requiredKeys": ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"],
      "optionalKeys": ["STRIPE_WEBHOOK_SECRET"],
      "detectedFrom": "Found in .env.example and src/lib/stripe.ts (stripe SDK import)",
      "files": ["src/lib/stripe.ts", "src/pages/api/checkout.ts"],
      "credentialType": "api_key",
      "requiresSignup": true,
      "optional": false
    }
  ],
  "builtInCapabilities": [
    // Platform features that DON'T require external credentials
    // INCLUDE: localStorage, sessionStorage, IndexedDB, cookies, icon libraries, APIs
    // These should NEVER appear in the integrations array above
    {
      "name": "Browser LocalStorage",
      "type": "storage",
      "description": "Client-side data persistence using browser's localStorage API",
      "detectedIn": ["src/hooks/useLocalStorage.ts", "src/utils/storage.ts"]
    },
    {
      "name": "Icon Library (Iconify/Material Icons/Font Awesome/etc.)",
      "type": "other",
      "description": "Icon library for UI components (CDN-based, no credentials needed)",
      "detectedIn": ["package.json", "components/"]
    }
  ],
  "environmentVariables": [
    {
      "name": "SUPABASE_URL",
      "required": true,
      "description": "Supabase project URL for database and auth",
      "example": "https://xxxxx.supabase.co",
      "detectedIn": [".env.example", "src/lib/supabase.ts"],
      "linkedIntegration": "Supabase"
    },
    {
      "name": "PORT",
      "required": false,
      "description": "Server port number",
      "example": "3000",
      "detectedIn": ["src/server.ts"],
      "linkedIntegration": null
    }
  ],
  "buildConfig": {
    "buildCommand": "Build command",
    "startCommand": "Start command",
    "devCommand": "Dev command",
    "testCommand": "Test command if found",
    "lintCommand": "Lint command if found",
    "outputDirectory": "Build output dir",
    "ports": [3000, 8080],
    "runtime": "Runtime version info (e.g., Node.js 20, Python 3.11)",
    "packageManager": "npm | yarn | pnpm | bun | pip | cargo | go | maven | gradle"
  },
  "security": {
    "hasEnvExample": true,
    "hasDotenvFile": false,
    "exposedSecrets": ["Potential exposed secrets found (files to review)"],
    "securityIssues": ["Security concerns discovered"],
    "recommendations": ["Security best practices to implement"]
  },
  "recommendations": [
    "Actionable recommendations based on what you found"
  ],
  "warnings": [
    "Issues or concerns discovered"
  ]
}
\`\`\`

---

## ENVIRONMENT VARIABLE NAMING (CASE-SENSITIVE!)

Environment variable names are CASE-SENSITIVE. Documentation can be WRONG.

**EFFICIENT VERIFICATION (do this ONCE early in exploration):**
Run a SINGLE grep to find all env var usages upfront:
\`\`\`
grep -r "process.env\\." src/ lib/ helpers/ 2>/dev/null | head -50
\`\`\`
This reveals the EXACT case used in code. Use those names, NOT README/docs if they differ.

**Example:** If code has \`process.env.secret\` but README says \`SECRET\`, use \`secret\`.

---

## EXTERNAL SERVICES DETECTION (integrations array)

**WHAT IS AN EXTERNAL SERVICE?**
A third-party service requiring ALL of:
1. Authentication credentials (API keys, tokens, connection strings)
2. Network communication with external servers
3. User account signup with the service provider

**WHAT IS NOT AN EXTERNAL SERVICE (do NOT add to integrations):**
- Browser APIs: localStorage, sessionStorage, cookies, IndexedDB, WebSockets API
- Built-in modules: Node.js fs, crypto, http, path
- Client-side libraries without external connections
- App configuration: PORT, NODE_ENV, HOST, LOG_LEVEL
- Internal secrets: JWT_SECRET, ENCRYPTION_KEY (unless from Auth0/external provider)
- Local paths: DATABASE_PATH (SQLite), UPLOAD_DIR

**DETECTION SOURCES (priority order):**
1. **.env.example, .env.local** - Check actual variable names and cases
2. **Code imports** - SDK usage (stripe, @supabase/*, openai, mongodb, pg, redis)
3. **docker-compose.yml** - External service dependencies
4. **README** - Secondary source (VERIFY against code!)

**COMMON SERVICE TYPES:**
- Databases: PostgreSQL, MongoDB, MySQL, Supabase, Redis
- Payment: Stripe, PayPal, Square
- Auth: Auth0, Clerk, Firebase Auth, Supabase Auth
- Email/SMS: SendGrid, Twilio, Resend
- Storage: AWS S3, Cloudinary
- AI: OpenAI, Anthropic

---

## DEPLOYABILITY ASSESSMENT

**DEPLOYABLE (true):** Apps that run standalone - web apps, APIs, microservices, anything listening on a port

**NOT DEPLOYABLE (false):** Libraries consumed by other projects - npm packages, component libraries, plugins, SDKs

**Quick Detection:**
- Has start script + listens on PORT → deployable
- Has "main"/"exports" in package.json pointing to lib/dist → library
- README says "npm install package-name" → library
- peerDependencies for React → component library

**Strong indicators of a DEPLOYABLE APP:**
1. **Start script runs a server** (node server.js, npm start, etc.)
2. **Listens on a PORT** (process.env.PORT, 3000, 8080)
3. **Has HTTP/WebSocket handling**
4. **README mentions "deployment", "hosting", "run locally"**
5. **Dockerfile or docker-compose.yml present**
6. **Vercel/Railway/Heroku config present**

---

**KEY OUTPUT NOTES:**
- \`frameworks\` and \`ports\` are ARRAYs (projects can have multiple)
- \`integrations\` = ONLY external services requiring credentials
- \`builtInCapabilities\` = platform features (no credentials)
- For each integration, list ALL \`requiredKeys\` with EXACT case from code
- Link env vars to integrations via \`linkedIntegration\` field

**OUTPUT RULES:**
- Explore SILENTLY using tools - NO text output during exploration
- Your ONLY output is the final JSON object (starts with {, ends with })
- NO preamble, NO explanations - PURE JSON only

**BEGIN EXPLORATION NOW. You have 25 steps max - use tools silently, then return ONLY the final JSON before step 25.**
`.trim();
}

/**
 * Build deployment config generation prompt
 * Always generates Docker + docker-compose.yml (universal deployment model)
 */
export function buildDeploymentConfigPrompt(request: DeploymentConfigRequest): string {
  const { analysisResult, optimizeFor = 'balanced' } = request;

  const optimizationInstructions = {
    speed: 'Prioritize fast build times and quick startup. Use caching aggressively.',
    size: 'Minimize final image/bundle size. Use multi-stage builds and slim base images.',
    security: 'Follow security best practices. Use non-root users, scan for vulnerabilities.',
    cost: 'Optimize for resource efficiency and lower cloud costs.',
    balanced: 'Balance between speed, size, and security.',
  }[optimizeFor];

  return `
You are an expert DevOps engineer. Generate production-ready Docker configuration for this project.

**Project Analysis:**
\`\`\`json
${JSON.stringify(analysisResult, null, 2)}
\`\`\`

**Optimization Goal:** ${optimizeFor} - ${optimizationInstructions}

**YOUR TASK:**
Generate Docker + docker-compose.yml configuration files in the CURRENT WORKING DIRECTORY.

**TOOLS AVAILABLE:**
- **readFile**: Read existing files (CHECK FOR EXISTING DOCKER FILES FIRST!)
- **globFind**: Search for files by pattern
- **writeFile**: Create configuration files (Dockerfile, docker-compose.yml, .dockerignore, .env.example, _summary.json)
- **validateDockerCompose**: Validate docker-compose.yml against official Docker Compose schema. MUST be called after writing docker-compose.yml!

**STEP 1 - CHECK FOR EXISTING FILES (CRITICAL):**
Before generating any files, use globFind and readFile to check if these files already exist:
- Dockerfile, Dockerfile.* (existing Docker builds)
- docker-compose.yml, docker-compose.yaml, compose.yml (existing compose configs)
- README.md, docs/*.md (documentation with deployment notes)

If the project has existing Docker files, READ THEM CAREFULLY. They show the original author's deployment intent and may contain important configuration details you should preserve or adapt.

**CRITICAL INSTRUCTIONS:**
- ALL files MUST be written using RELATIVE paths (e.g., "Dockerfile", "docker-compose.yml")
- DO NOT use absolute paths (e.g., /Users/... or /home/...)
- If existing Docker files exist, use them as a reference - adapt and improve rather than starting from scratch
- Create ONLY production-ready files - no development variants, Makefiles, or separate README files
- The writeFile tool will automatically save files in your current working directory
- **ALWAYS validate docker-compose.yml immediately after writing it**
- If validation fails, fix the errors and re-validate until it passes
- Create a _summary.json file as the FINAL step

**ALWAYS CREATE THESE FILES:**

1. **Dockerfile** - Multi-stage production build
   - Use specific base image versions (not 'latest')
   - Multi-stage build for smaller final image
   - Run as non-root user
   - Include health check
   - Properly handle signals for graceful shutdown
   - Copy package files first for better layer caching

2. **docker-compose.yml** - Runtime configuration (SOURCE OF TRUTH)
   - MUST follow the exact structure shown in the template below
   - Use ONLY valid Docker Compose properties (see reference below)
   - NO Kubernetes properties allowed

3. **.dockerignore** - Build exclusions
   - node_modules, .git, IDE files, test files

4. **.env.example** - Template for required environment variables
   - All required env vars with placeholder values
   - Comments explaining each variable

**WORKFLOW:**
1. Analyze the project structure from the analysis results
2. Determine what files are truly needed based on project complexity
3. Use writeFile to create Dockerfile
4. Use writeFile to create docker-compose.yml
5. **IMMEDIATELY call validateDockerCompose** to validate the docker-compose.yml
6. **IF validation fails**: Read the error messages, fix the issues, write the corrected docker-compose.yml, and validate again
7. **REPEAT steps 5-6** until docker-compose.yml passes validation
8. Use writeFile to create .dockerignore and .env.example
9. **FINAL STEP**: Use writeFile to create _summary.json with metadata

**CRITICAL: VALIDATION LOOP**
You MUST validate docker-compose.yml and fix any errors before proceeding. Do NOT skip validation.
If validateDockerCompose returns errors, you must:
1. Read the specific error messages
2. Fix each error in the docker-compose.yml content
3. Write the corrected file using writeFile
4. Call validateDockerCompose again
5. Repeat until validation passes

**SUMMARY FILE (_summary.json) FORMAT:**
Create a file named **_summary.json** with this exact structure.
This file contains project discovery details, AI analysis, third-party integrations, and deployment instructions:

\`\`\`json
{
  "projectSummary": {
    "overview": "Brief description of what this project does",
    "framework": "Detected framework and version (e.g., Next.js 14, Nuxt 3, Express)",
    "runtime": "Runtime environment (e.g., Node.js 20, Python 3.11)",
    "buildTool": "Build tool used (e.g., npm, pnpm, yarn, pip)",
    "isMultiService": false,
    "services": ["main app"],
    "mainPort": 3000,
    "dependencies": {
      "production": ["key", "production", "dependencies"],
      "development": ["dev", "dependencies"]
    }
  },
  "integrations": {
    "detected": [
      {
        "name": "PostgreSQL Database",
        "service": "postgresql",
        "type": "database",
        "requiredKeys": ["DATABASE_URL"],
        "optional": false,
        "detectedFrom": "Found in docker-compose.yml and src/lib/db.ts",
        "credentialType": "connection_string",
        "composeServiceName": "postgres",
        "notes": "PostgreSQL database for data storage"
      },
      {
        "name": "MongoDB Database",
        "service": "mongodb",
        "type": "database",
        "requiredKeys": ["MONGO_URI"],
        "optional": false,
        "detectedFrom": "Found in docker-compose.yml and src/lib/mongo.ts",
        "credentialType": "connection_string",
        "composeServiceName": "mongodb",
        "notes": "MongoDB for document storage"
      },
      {
        "name": "Redis Cache",
        "service": "redis",
        "type": "cache",
        "requiredKeys": ["REDIS_URL"],
        "optional": true,
        "detectedFrom": "Found in docker-compose.yml",
        "credentialType": "connection_string",
        "composeServiceName": "redis",
        "notes": "Redis for caching and session storage"
      },
      {
        "name": "Stripe Payments",
        "service": "stripe",
        "type": "payment",
        "requiredKeys": ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"],
        "optionalKeys": ["STRIPE_WEBHOOK_SECRET"],
        "optional": false,
        "detectedFrom": "Found in src/lib/stripe.ts with Stripe SDK import",
        "credentialType": "api_key",
        "composeServiceName": null,
        "notes": "External API - no container in docker-compose"
      }
    ],
    "databases": ["PostgreSQL (via Supabase)"],
    "caches": ["Redis (if detected)"],
    "queues": [],
    "externalServices": ["Stripe", "OpenAI"]
  },
  "builtInCapabilities": [
    {
      "name": "Browser LocalStorage",
      "type": "storage",
      "description": "Client-side data persistence - no external service required",
      "detectedIn": ["src/hooks/useLocalStorage.ts"]
    }
  ],
  "environmentVariables": {
    "required": [
      {
        "key": "DATABASE_URL",
        "description": "PostgreSQL connection string",
        "example": "postgresql://user:pass@host:5432/db",
        "linkedIntegration": "PostgreSQL Database"
      },
      {
        "key": "SUPABASE_URL",
        "description": "Supabase project URL",
        "example": "https://xxxxx.supabase.co",
        "linkedIntegration": "Supabase"
      },
      {
        "key": "SUPABASE_ANON_KEY",
        "description": "Supabase anonymous/public API key",
        "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "linkedIntegration": "Supabase"
      }
    ],
    "optional": [
      {
        "key": "REDIS_URL",
        "description": "Redis connection string for caching",
        "example": "redis://localhost:6379",
        "linkedIntegration": "Redis Cache"
      },
      {
        "key": "PORT",
        "description": "Server port number",
        "example": "3000",
        "linkedIntegration": null
      }
    ]
  },
  "files": [
    {
      "fileName": "Dockerfile",
      "description": "Multi-stage Docker build optimized for production"
    },
    {
      "fileName": "docker-compose.yml",
      "description": "Docker Compose configuration for running the application"
    },
    {
      "fileName": ".dockerignore",
      "description": "Docker ignore file to reduce build context"
    },
    {
      "fileName": ".env.example",
      "description": "Template for required environment variables"
    }
  ],
  "deployment": {
    "instructions": "## Deployment Instructions\\n\\n### Prerequisites\\n- Docker and Docker Compose installed\\n- Copy .env.example to .env and configure\\n\\n### Steps\\n1. Configure: \`cp .env.example .env\` and edit values\\n2. Start: \`docker compose up -d\`\\n3. View logs: \`docker compose logs -f\`\\n4. Stop: \`docker compose down\`",
    "buildCommand": "docker compose build",
    "runCommand": "docker compose up -d"
  },
  "recommendations": [
    "Configure Supabase credentials before deployment",
    "Set up proper database migrations",
    "Consider using a CDN for static assets",
    "Run npm audit to check for security vulnerabilities",
    "Use environment variables for all sensitive configuration"
  ],
  "security": {
    "hasEnvExample": true,
    "considerations": [
      "Container runs as non-root user for security isolation",
      "No sensitive environment variables exposed in code",
      "Consider adding security headers in application config"
    ],
    "vulnerabilityWarnings": [
      "TypeScript 4.7.4 is outdated - update to 5.x for security patches",
      "Run npm audit to identify vulnerable packages"
    ]
  },
  "optimization": {
    "strategy": "speed",
    "features": [
      "Multi-stage builds for faster rebuilds",
      "Layer caching for dependencies",
      "Alpine base image for smaller size"
    ]
  }
}
\`\`\`

**CRITICAL: ENVIRONMENT VARIABLE NAMING (CASE-SENSITIVE!)**

Environment variable names are CASE-SENSITIVE. Documentation can be WRONG.

**REQUIRED VERIFICATION:**
For EVERY env var, grep the codebase to find EXACT usage in code:
\`\`\`
grep -r "process.env." src/ helpers/ lib/   # Find all env var usages
\`\`\`
Use the EXACT case from code (e.g., \`process.env.secret\`), NOT from README or .env.example if they differ!

**Example Problem:**
- README says: \`SECRET=your_jwt_secret\`
- Code uses: \`process.env.secret\` (lowercase!)
- Docker-compose must use: \`secret: \${secret}\` (lowercase!)

---

**EXTERNAL SERVICES (integrations array)**

An external service requires: credentials + external network + service signup

**NOT external services:** localStorage, cookies, browser APIs, built-in modules, PORT, NODE_ENV, JWT_SECRET

**Detection Sources (priority order):**
1. **Code usage** - Grep for \`process.env.xxx\` to get EXACT variable names
2. **.env.example, .env.local** - Usually reliable
3. **Package imports** - SDKs like @supabase/*, stripe, openai, pg, redis
4. **README** - Secondary source (VERIFY against code!)

**CRITICAL: composeServiceName Field**
- Has container in docker-compose → \`"composeServiceName": "postgres"\` (exact name)
- External API (no container) → \`"composeServiceName": null\` (Stripe, OpenAI, etc.)

**For Each Service:**
- \`requiredKeys\`: ALL env vars with EXACT case from code
- \`composeServiceName\`: service name from docker-compose or null
- \`type\`: database, cache, payment, auth, email, storage, ai, etc.

**Built-in Capabilities (NOT services):**
localStorage, sessionStorage, cookies, browser APIs → \`builtInCapabilities\` array, NOT \`integrations\`.

**IMPORTANT RULES:**
- The _summary.json file is for metadata and analysis - NOT a deployment config file
- List ONLY the actual config files in the "files" array (Dockerfile, .dockerignore, etc.)
- Do NOT include _summary.json itself in the "files" array
- Do NOT include file content in the summary - only fileName and description
- Include comprehensive "integrations" detection with ALL required API keys
- Include all "environmentVariables" needed for deployment
- Provide actionable "recommendations" for deployment preparation
- After creating _summary.json, you're done

**═══════════════════════════════════════════════════════════════════════════════**
**DOCKERFILE REFERENCE - CHOOSE THE RIGHT PATTERN**
**═══════════════════════════════════════════════════════════════════════════════**

**IMPORTANT: Detect which pattern to use based on the framework:**

**PATTERN A: STANDALONE BUILDS (Nuxt 3, Next.js standalone, Vite SSR)**
- These frameworks bundle everything into a standalone output folder
- NO node_modules needed at runtime
- Use 2-stage build: builder → runner
- Output folders: Nuxt=\`.output\`, Next.js=\`.next/standalone\`, Vite=\`dist\`

**PATTERN B: TRADITIONAL NODE.JS (Express, Fastify, NestJS, Hono)**
- These need node_modules at runtime
- Use 3-stage build: deps → builder → runner
- Copy node_modules from deps stage to runner

**═══════════════════════════════════════════════════════════════════════════════**

**PATTERN A: STANDALONE BUILD (E.g Nuxt 3 example):**

\`\`\`dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Delete lock file to avoid platform-specific optional dependency issues (npm bug)
RUN rm -f package-lock.json && npm install
COPY . .
RUN npm run build

# Stage 2: Production (standalone - no node_modules needed)
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 appuser

# Only copy the standalone build output
COPY --from=builder --chown=appuser:nodejs /app/.output ./.output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", ".output/server/index.mjs"]
\`\`\`

**PATTERN B: TRADITIONAL BUILD (Express/Fastify example):**

\`\`\`dockerfile
# Stage 1: Dependencies (production only)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Delete lock file to avoid platform-specific optional dependency issues (npm bug)
RUN rm -f package-lock.json && npm install --omit=dev

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN rm -f package-lock.json && npm install
COPY . .
RUN npm run build

# Stage 3: Production (needs node_modules)
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 appuser

COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "dist/index.js"]
\`\`\`

**DOCKERFILE BEST PRACTICES:**
- Use specific base image versions (node:20-alpine, NOT node:latest)
- Detect framework type and use appropriate pattern (standalone vs traditional)
- Create non-root user with adduser/addgroup
- Copy package files BEFORE source for layer caching
- CRITICAL: Delete package-lock.json and use \`npm install\` (NEVER \`npm ci\` - it requires lock file!)
- For traditional builds: use \`npm install --omit=dev\` in deps stage
- Set proper file ownership before switching to non-root user
- Include HEALTHCHECK instruction
- Use exec form for CMD: ["node", "app.js"] not "node app.js"
- Minimize layers by combining RUN commands with &&

**═══════════════════════════════════════════════════════════════════════════════**

**═══════════════════════════════════════════════════════════════════════════════**
**DOCKER-COMPOSE.YML REFERENCE - FOLLOW THIS EXACTLY**
**═══════════════════════════════════════════════════════════════════════════════**

**VALID DOCKER COMPOSE TEMPLATE (use this as your reference):**

**CRITICAL RULES:**
- NO "version" field (modern compose doesn't use it)
- MUST have "name" field at top level
- Use ONLY "build" for local builds (NEVER both "build" and "image" together)
- Ports MUST bind to interface: "127.0.0.1:\${PORT:-3000}:3000"
- Ports MUST be quoted strings

\`\`\`yaml
name: my-project

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: my-project
    ports:
      - "127.0.0.1:\${PORT:-3000}:3000"
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 3000
    working_dir: /app
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    user: "1001:1001"
    cap_drop:
      - ALL
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 10s
    stop_signal: SIGTERM

networks:
  default:
    driver: bridge
    name: my-project-network
\`\`\`

**VALID SERVICE-LEVEL PROPERTIES (only use these):**
| Property | Type | Description |
|----------|------|-------------|
| build | object/string | Build configuration (MUTUALLY EXCLUSIVE with "image") |
| image | string | Image name (MUTUALLY EXCLUSIVE with "build") |
| container_name | string | Container name |
| ports | list | Port mappings as QUOTED STRINGS: "127.0.0.1:host:container" |
| environment | list/object | Environment variables |
| env_file | list | External env files |
| volumes | list | Volume mounts |
| networks | list | Network connections |
| depends_on | list/object | Service dependencies |
| restart | string | Restart policy |
| healthcheck | object | Health check config |
| deploy | object | Deployment config (resources, replicas) |
| command | string/list | Override CMD |
| entrypoint | string/list | Override ENTRYPOINT |
| working_dir | string | Working directory |
| user | string | User to run as (e.g., "1000:1000") |
| security_opt | list | Security options |
| cap_drop | list | Drop Linux capabilities |
| cap_add | list | Add Linux capabilities |
| read_only | boolean | Read-only root filesystem |
| stdin_open | boolean | Keep STDIN open |
| tty | boolean | Allocate TTY |
| logging | object | Logging configuration |
| labels | list/object | Container labels |
| extra_hosts | list | Additional hosts |
| dns | list | DNS servers |
| tmpfs | list | Tmpfs mounts |
| shm_size | string | Size of /dev/shm |
| ulimits | object | Ulimit settings |
| sysctls | object | Sysctl settings |
| stop_grace_period | string | Stop timeout |
| stop_signal | string | Stop signal |
| privileged | boolean | Privileged mode |
| pid | string | PID mode |
| ipc | string | IPC mode |
| hostname | string | Container hostname |
| domainname | string | Container domain |

**FORBIDDEN PROPERTIES (these are Kubernetes-only, NEVER use):**
| Invalid Property | Valid Alternative |
|------------------|-------------------|
| read_only_root_filesystem | read_only: true/false |
| runAsNonRoot | user: "1000:1000" |
| runAsUser | user: "1000:1000" |
| runAsGroup | user: "1000:1000" |
| fsGroup | N/A (use volumes with proper permissions) |
| allowPrivilegeEscalation | security_opt: [no-new-privileges:true] |
| securityContext | Use individual properties above |
| capabilities.drop | cap_drop: [ALL] |
| capabilities.add | cap_add: [NET_BIND_SERVICE] |
| resources.limits.cpu | deploy.resources.limits.cpus |
| resources.limits.memory | deploy.resources.limits.memory |
| livenessProbe | healthcheck |
| readinessProbe | healthcheck |
| containerPort | ports: ["host:container"] |
| imagePullPolicy | N/A (use image tags) |

**VALIDATION CHECKLIST (verify before writing):**
1. NO "version" field at top level
2. "name" field MUST exist at top level
3. Use "build" OR "image", NEVER BOTH together (mutually exclusive!)
4. Ports MUST be quoted strings with interface: "127.0.0.1:3000:3000"
5. All properties exist in the VALID table above
6. No Kubernetes properties from the FORBIDDEN table
7. \`read_only\` NOT \`read_only_root_filesystem\`
8. \`user\` NOT \`runAsUser\` or \`runAsNonRoot\`
9. \`security_opt\` for security options
10. \`cap_drop\`/\`cap_add\` at service level (not nested)
11. \`deploy.resources\` for resource limits
12. \`healthcheck\` NOT \`livenessProbe\`/\`readinessProbe\`

**═══════════════════════════════════════════════════════════════════════════════**

**Framework-Specific Requirements:**
- Detected frameworks: ${analysisResult.frameworks.map((f: any) => f.name).join(', ')}
- Build command: ${analysisResult.buildConfig.buildCommand || 'npm run build'}
- Start command: ${analysisResult.buildConfig.startCommand || 'npm start'}
- Ports: ${analysisResult.buildConfig.ports.join(', ')}
- Runtime: ${analysisResult.buildConfig.runtime || 'Node.js 20'}

**Environment Variables:**
${
  analysisResult.environmentVariables.length > 0
    ? analysisResult.environmentVariables
        .map(
          (env: any) =>
            `- ${env.name} (${env.required ? 'required' : 'optional'}): ${env.description || ''}`
        )
        .join('\n')
    : '- No environment variables detected'
}

**Third-Party Integrations Detected:**
${
  analysisResult.integrations.length > 0
    ? analysisResult.integrations
        .map(
          (int: any) =>
            `- ${int.name || int.service} (${int.type}): ${int.requiredKeys?.join(', ') || int.envVars?.join(', ') || 'credentials required'}`
        )
        .join('\n')
    : '- No external integrations detected (self-contained application)'
}

${
  analysisResult.builtInCapabilities && analysisResult.builtInCapabilities.length > 0
    ? `\n**Built-in Capabilities (No External Services):**\n${analysisResult.builtInCapabilities.map((cap: any) => `- ${cap.name}: ${cap.description}`).join('\n')}`
    : ''
}

**CRITICAL RULES:**
- **USE THE WRITE TOOL** to create each configuration file in the project directory
- **CREATE _summary.json as your FINAL step** - this file contains metadata about all files you created
- Include helpful comments in generated files
- Follow ${optimizeFor} optimization strategy
- Make it production-ready
- After creating _summary.json, you're done

Generate the configuration now. Write all files including _summary.json.
`.trim();
}

/**
 * Prompt templates for specific tasks
 */
export const PromptTemplates = {
  /**
   * Get system prompt for project analysis
   */
  getAnalysisSystemPrompt: () => SystemPrompts.projectAnalysis,

  /**
   * Get system prompt for config generation
   */
  getConfigGenerationSystemPrompt: () => SystemPrompts.configGeneration,

  /**
   * Build complete project analysis prompt
   */
  buildAnalysisPrompt: buildProjectAnalysisPrompt,

  /**
   * Build complete deployment config prompt
   */
  buildConfigPrompt: buildDeploymentConfigPrompt,
} as const;

/**
 * Validate analysis result structure
 */
export function validateAnalysisResult(result: any): result is ProjectAnalysisResult {
  return (
    typeof result === 'object' &&
    // Summary
    result.summary &&
    typeof result.summary.overview === 'string' &&
    typeof result.summary.purpose === 'string' &&
    typeof result.summary.deployable === 'boolean' &&
    typeof result.summary.deploymentNotes === 'string' &&
    // Frameworks is now an array
    Array.isArray(result.frameworks) &&
    result.frameworks.length > 0 &&
    typeof result.frameworks[0].name === 'string' &&
    typeof result.frameworks[0].confidence === 'number' &&
    // Language
    result.language &&
    typeof result.language.primary === 'string' &&
    // Project type
    typeof result.projectType === 'string' &&
    // Project structure
    result.projectStructure &&
    typeof result.projectStructure.rootDirectory === 'string' &&
    Array.isArray(result.projectStructure.configFiles) &&
    Array.isArray(result.projectStructure.entryPoints) &&
    // Dependencies
    result.dependencies &&
    Array.isArray(result.dependencies.production) &&
    typeof result.dependencies.totalCount === 'number' &&
    // Integrations
    Array.isArray(result.integrations) &&
    // Environment variables
    Array.isArray(result.environmentVariables) &&
    // Build config (ports is now an array)
    result.buildConfig &&
    Array.isArray(result.buildConfig.ports) &&
    // Security
    result.security &&
    typeof result.security.hasEnvExample === 'boolean' &&
    Array.isArray(result.security.exposedSecrets) &&
    // Recommendations
    Array.isArray(result.recommendations)
  );
}

/**
 * Find valid JSON object using bracket matching
 * More reliable than regex for nested JSON
 * Returns { json, isTruncated } to indicate if JSON was incomplete
 */
function findJsonByBracketMatching(text: string): {
  json: string | null;
  isTruncated: boolean;
  missingBraces: number;
} {
  const startIndex = text.indexOf('{');
  if (startIndex === -1) return { json: null, isTruncated: false, missingBraces: 0 };

  let depth = 0;
  let maxDepth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return { json: text.substring(startIndex, i + 1), isTruncated: false, missingBraces: 0 };
      }
    }
  }

  // If we get here, JSON is incomplete (truncated)
  // Return the partial JSON and indicate how many braces are missing
  if (depth > 0 && maxDepth > 0) {
    return {
      json: text.substring(startIndex),
      isTruncated: true,
      missingBraces: depth,
    };
  }

  return { json: null, isTruncated: false, missingBraces: 0 };
}

/**
 * Attempt to repair truncated JSON by closing open structures
 */
function repairTruncatedJson(partialJson: string, _missingBraces: number): string | null {
  let repaired = partialJson.trim();

  // Remove trailing incomplete elements
  // Common patterns: incomplete string, trailing comma, incomplete key
  repaired = repaired
    .replace(/,\s*$/, '') // Remove trailing comma
    .replace(/,\s*"[^"]*$/, '') // Remove incomplete key-value
    .replace(/"[^"]*$/, '""') // Close incomplete string
    .replace(/:\s*$/, ': null') // Add null for incomplete value
    .replace(/:\s*"[^"]*$/, ': ""'); // Close incomplete string value

  // Count current open structures
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of repaired) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
  }

  // Close open structures
  while (bracketCount > 0) {
    repaired += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    repaired += '}';
    braceCount--;
  }

  return repaired;
}

/**
 * Check if parsed JSON contains expected analysis fields
 */
function hasExpectedAnalysisFields(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null) return false;

  const hasAnalysisFields =
    obj.summary !== undefined ||
    obj.frameworks !== undefined ||
    obj.language !== undefined ||
    obj.projectType !== undefined ||
    obj.buildConfig !== undefined ||
    obj.dependencies !== undefined;

  const hasConfigFields =
    obj.projectSummary !== undefined || obj.files !== undefined || obj.deployment !== undefined;

  return hasAnalysisFields || hasConfigFields;
}

/**
 * Parse AI response and extract JSON
 * Uses multiple strategies to handle various response formats
 */
export function extractJsonFromResponse(response: string): any {
  // Handle empty or undefined responses
  if (!response || response.trim().length === 0) {
    throw new Error(
      'Received empty response from AI. The model may not have completed its response.'
    );
  }

  const trimmed = response.trim();

  // Strategy 1: Try parsing the entire response as pure JSON first
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (hasExpectedAnalysisFields(parsed)) {
        return parsed;
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 2: Extract JSON from markdown code blocks (```json ... ```)
  const codeBlockPatterns = [
    /```json\s*\n([\s\S]*?)\n```/, // Standard json code block
    /```\s*\n(\{[\s\S]*?\})\n```/, // Generic code block with JSON object
    /```(?:json)?\s*([\s\S]*?)```/, // Any code block
  ];

  for (const pattern of codeBlockPatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (hasExpectedAnalysisFields(parsed)) {
          return parsed;
        }
      } catch {
        // Continue to next pattern
      }
    }
  }

  // Strategy 3: Use bracket matching to find complete JSON object
  // This is more reliable than regex for nested JSON with preamble text
  const bracketResult = findJsonByBracketMatching(trimmed);

  if (bracketResult.json && !bracketResult.isTruncated) {
    try {
      const parsed = JSON.parse(bracketResult.json);
      if (hasExpectedAnalysisFields(parsed)) {
        return parsed;
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3b: If JSON was truncated, try to repair it
  if (bracketResult.json && bracketResult.isTruncated) {
    const repaired = repairTruncatedJson(bracketResult.json, bracketResult.missingBraces);
    if (repaired) {
      try {
        const parsed = JSON.parse(repaired);
        if (hasExpectedAnalysisFields(parsed)) {
          return parsed;
        }
      } catch {
        // Repair failed, continue to next strategy
      }
    }
  }

  // Strategy 4: Try to find JSON starting after common preamble patterns
  const preamblePatterns = [
    /(?:here(?:'s| is) (?:the|my) (?:analysis|json|result)[:\s]*)/i,
    /(?:final (?:analysis|json|result)[:\s]*)/i,
    /(?:json (?:analysis|output|result)[:\s]*)/i,
    /(?:let me (?:provide|compile|create)[^{]*)/i,
    /(?:now i (?:have|will|can)[^{]*)/i,
  ];

  for (const pattern of preamblePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const afterPreamble = trimmed.substring(match.index! + match[0].length);
      const preambleResult = findJsonByBracketMatching(afterPreamble);
      if (preambleResult.json && !preambleResult.isTruncated) {
        try {
          const parsed = JSON.parse(preambleResult.json);
          if (hasExpectedAnalysisFields(parsed)) {
            return parsed;
          }
        } catch {
          // Continue to next pattern
        }
      }
      // Try repair if truncated
      if (preambleResult.json && preambleResult.isTruncated) {
        const repaired = repairTruncatedJson(preambleResult.json, preambleResult.missingBraces);
        if (repaired) {
          try {
            const parsed = JSON.parse(repaired);
            if (hasExpectedAnalysisFields(parsed)) {
              return parsed;
            }
          } catch {
            // Continue to next pattern
          }
        }
      }
    }
  }

  // Strategy 5: Last resort - try all possible JSON objects in the response
  let searchStart = 0;
  while (searchStart < trimmed.length) {
    const nextBrace = trimmed.indexOf('{', searchStart);
    if (nextBrace === -1) break;

    const potentialResult = findJsonByBracketMatching(trimmed.substring(nextBrace));
    if (potentialResult.json) {
      // Try complete JSON first
      if (!potentialResult.isTruncated) {
        try {
          const parsed = JSON.parse(potentialResult.json);
          if (hasExpectedAnalysisFields(parsed)) {
            return parsed;
          }
        } catch {
          // Try next occurrence
        }
      } else {
        // Try repair
        const repaired = repairTruncatedJson(potentialResult.json, potentialResult.missingBraces);
        if (repaired) {
          try {
            const parsed = JSON.parse(repaired);
            if (hasExpectedAnalysisFields(parsed)) {
              return parsed;
            }
          } catch {
            // Try next occurrence
          }
        }
      }
      searchStart = nextBrace + 1;
    } else {
      break;
    }
  }

  // Check if response appears truncated (has opening brace but no proper closing)
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  const isTruncated = openBraces > closeBraces && openBraces > 0;

  if (isTruncated) {
    throw new Error(
      `AI response was truncated (incomplete JSON). The model ran out of output tokens before completing the response. ` +
        `Try using a model with higher token limits, or simplify the project.\n\n` +
        `Response preview: ${response.substring(0, 300)}...`
    );
  }

  // All strategies failed
  throw new Error(
    `Failed to extract valid JSON from AI response. The model may have returned an unexpected format.\n\n` +
      `Raw response (length: ${response.length}):\n${response.substring(0, 500)}${response.length > 500 ? '...' : ''}`
  );
}
