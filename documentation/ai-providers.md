# AI Provider System

**DXLander** uses a pluggable AI provider system that enables project analysis and deployment configuration generation using various AI models. This document explains the architecture, how to add new providers, and best practices.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Available Providers](#available-providers)
- [Tool System](#tool-system)
- [Adding a New Provider](#adding-a-new-provider)
- [Testing Providers](#testing-providers)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)

---

## Overview

### What is an AI Provider?

An AI provider is a component that interfaces with an AI model (like Claude, GPT-4, or Llama) to perform intelligent operations on user projects:

- **Project Analysis**: Detect frameworks, dependencies, integrations, and configurations
- **Deployment Config Generation**: Create Dockerfiles, Kubernetes manifests, Vercel configs, etc.
- **Chat**: Answer questions about projects or provide development guidance

### Why Multiple Providers?

Different providers offer different benefits:

- **Cost**: Some providers are free (Groq), others are paid (OpenAI)
- **Performance**: Some are faster (Groq), others more capable (Claude)
- **Features**: Some have built-in tools (Claude Agent SDK), others are API-only
- **Privacy**: Some are hosted (OpenAI), others can run locally (Ollama)

---

## Architecture

### Provider Interface

All providers implement the `IAIProvider` interface:

```typescript
interface IAIProvider {
  // Provider identifier
  readonly name: AIProviderType;

  // Initialize with API key and settings
  initialize(config: AIProviderConfig): Promise<void>;

  // Test if API key is valid
  testConnection(): Promise<boolean>;

  // Get list of available models
  getAvailableModels(): Promise<string[]>;

  // Analyze a project using AI + tools
  analyzeProject(context: ProjectContext): Promise<ProjectAnalysisResult>;

  // Generate deployment configurations
  generateDeploymentConfig(request: DeploymentConfigRequest): Promise<DeploymentConfigResult>;

  // Basic chat/completion
  chat(request: AICompletionRequest): Promise<AICompletionResponse>;
}
```

### Provider Types

There are two categories of providers:

#### 1. Tool-Based Providers (Groq, OpenRouter)

These extend `BaseToolProvider` and use **Vercel AI SDK v5** for unified tool-calling:

```
┌─────────────────────────────────────┐
│      BaseToolProvider               │
│  (Shared tool orchestration logic)  │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼────────┐
│ GroqProvider│  │OpenRouter    │
│             │  │Provider      │
└─────────────┘  └──────────────┘
```

**Benefits:**

- Automatic tool orchestration
- Unified analysis capabilities
- Less code duplication
- Easy to add new providers

#### 2. SDK-Based Providers (Claude Agent SDK)

These use their own built-in tool systems:

```
┌──────────────────────────────┐
│   ClaudeAgentProvider        │
│ (Uses @anthropic-ai/        │
│  claude-agent-sdk)           │
└──────────────────────────────┘
```

**Benefits:**

- More powerful tools (Read, Write, Edit, Bash)
- Native SDK optimizations
- Advanced features (MCP servers, web search)

---

## Available Providers

### Claude Agent SDK

**Provider Type:** `claude-agent-sdk`
**Package:** `@anthropic-ai/claude-agent-sdk`
**Best For:** Deep project analysis, complex reasoning

**Features:**

- ✅ File system access (Read, Write, Edit)
- ✅ Code execution (Bash commands)
- ✅ Web search
- ✅ MCP server integration
- ✅ Built-in tool orchestration

**Configuration:**

```typescript
{
  provider: 'claude-agent-sdk',
  apiKey: 'sk-ant-...', // Anthropic API key
  model: 'claude-sonnet-4-5-20250929'
}
```

**Available Models:**

- `claude-sonnet-4-5-20250929` (Latest Sonnet 4.5)
- `claude-sonnet-4` (Sonnet 4)
- `claude-opus-4` (Most capable, slower)
- `claude-haiku-4` (Fast, cost-effective)

---

### Groq

**Provider Type:** `groq`
**Package:** Vercel AI SDK (`@ai-sdk/openai`)
**Best For:** Fast inference with open-source models

**Features:**

- ✅ Tool-calling (readFile, grepSearch, globFind, listDirectory)
- ✅ Free tier available
- ✅ Very fast inference
- ✅ Open-source models (Llama, Mixtral)

**Configuration:**

```typescript
{
  provider: 'groq',
  apiKey: 'gsk_...', // Groq API key
  model: 'llama-3.3-70b-versatile'
}
```

**Available Models:**

- `llama-3.3-70b-versatile` (Best quality, free)
- `llama-3.1-8b-instant` (Fastest, free)
- `openai/gpt-oss-120b` (Large model, free)
- `qwen/qwen3-32b` (Balanced, free)

---

### OpenRouter

**Provider Type:** `openrouter`
**Package:** Vercel AI SDK (`@ai-sdk/openai`)
**Best For:** Access to many models via one API

**Features:**

- ✅ Tool-calling (readFile, grepSearch, globFind, listDirectory)
- ✅ 100+ models available
- ✅ Unified pricing and API
- ✅ Automatic retry on rate limits

**Configuration:**

```typescript
{
  provider: 'openrouter',
  apiKey: 'sk-or-v1-...', // OpenRouter API key
  model: 'anthropic/claude-3.5-sonnet'
}
```

**Popular Models:**

- `anthropic/claude-3.5-sonnet` (Best quality)
- `openai/gpt-4-turbo` (Fast, capable)
- `google/gemini-pro` (Free tier)
- `meta-llama/llama-3-70b` (Free, open-source)

---

## Tool System

Providers (except Claude Agent SDK) use a shared tool system that allows AI models to explore projects autonomously.

### Available Tools

#### `readFile`

Read file contents from the project.

```typescript
{
  toolName: 'readFile',
  input: {
    filePath: 'package.json' // Relative to project root
  }
}
```

**Security:** Validates path with `isPathSafe()` to prevent traversal attacks.

#### `grepSearch`

Search for text patterns using regex (powered by ripgrep).

```typescript
{
  toolName: 'grepSearch',
  input: {
    pattern: 'import.*from',      // Regex pattern
    glob: '**/*.{ts,tsx}',         // Optional: file filter
    caseSensitive: true            // Optional: default true
  }
}
```

#### `globFind`

Find files matching glob patterns.

```typescript
{
  toolName: 'globFind',
  input: {
    pattern: '**/*.config.{js,ts}' // Glob pattern
  }
}
```

#### `listDirectory`

List contents of a directory.

```typescript
{
  toolName: 'listDirectory',
  input: {
    dirPath: 'src/components' // Optional: default is root
  }
}
```

### How Tools Work

1. **AI decides** which tools to use based on the task
2. **Tool is called** with validated parameters
3. **Result is returned** to the AI
4. **AI continues** until task is complete

Example flow for project analysis:

```
1. AI: "I need to understand this project"
2. AI calls: readFile('package.json')
3. AI sees: "This is a Next.js project"
4. AI calls: grepSearch('import.*next', '**/*.tsx')
5. AI calls: globFind('**/*.config.js')
6. AI synthesizes: "Next.js 14 with TypeScript and Tailwind"
```

---

## Adding a New Provider

### Step 1: Choose Provider Category

**Tool-Based Provider** (recommended for most cases):

- Extends `BaseToolProvider`
- Automatic tool orchestration
- ~100-200 lines of code

**SDK-Based Provider** (for providers with native SDKs):

- Implements `IAIProvider` directly
- Custom tool implementation
- More control, more code

### Step 2: Create Provider Class

For a tool-based provider:

```typescript
// packages/shared/src/services/ai/providers/my-provider.ts
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseToolProvider } from './base-tool-provider';

export class MyProvider extends BaseToolProvider {
  readonly name = 'my-provider' as const;

  /**
   * Get the language model instance
   * This is the ONLY method you need to implement!
   */
  async getLanguageModel(): Promise<LanguageModel> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const client = createOpenAI({
      baseURL: 'https://api.example.com/v1',
      apiKey: this.config.apiKey,
    });

    return client(this.config.model || 'default-model');
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.config?.apiKey) {
      return false;
    }

    try {
      // Make a simple API call to test the key
      const response = await fetch('https://api.example.com/v1/models', {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    return ['model-1', 'model-2', 'model-3'];
  }
}
```

### Step 3: Register Provider Type

Add to type definition:

```typescript
// packages/shared/src/services/ai/types.ts
export type AIProviderType = 'claude-agent-sdk' | 'groq' | 'openrouter' | 'my-provider'; // ← Add here
```

### Step 4: Export Provider

```typescript
// packages/shared/src/services/ai/providers/index.ts
export { MyProvider } from './my-provider';
```

### Step 5: Add to Factory

```typescript
// packages/shared/src/services/ai/factory.ts
import { MyProvider } from './providers/my-provider';

export function createAIProvider(type: AIProviderType): IAIProvider {
  switch (type) {
    case 'claude-agent-sdk':
      return new ClaudeAgentProvider();
    case 'groq':
      return new GroqProvider();
    case 'openrouter':
      return new OpenRouterProvider();
    case 'my-provider':
      return new MyProvider(); // ← Add here
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}
```

### Step 6: Add Testing Support

```typescript
// apps/api/src/services/ai-provider-tester.service.ts
class MyProviderTester implements IProviderTester {
  validateConfig(config: ProviderTestConfig): void {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
  }

  async test(config: ProviderTestConfig): Promise<ProviderTestResult> {
    this.validateConfig(config);

    try {
      const { MyProvider } = await import('@dxlander/shared');
      const provider = new MyProvider();

      await provider.initialize({
        provider: 'my-provider',
        apiKey: config.apiKey!,
        model: config.settings?.model || 'default-model',
      });

      return {
        success: true,
        message: 'Successfully connected',
        model: config.settings?.model || 'default-model',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        model: config.settings?.model || 'default-model',
      };
    }
  }
}

// Register in ProviderTesterRegistry constructor:
constructor() {
  this.register('my-provider', new MyProviderTester());
}
```

### Step 7: Add UI Support (Optional)

Update the frontend provider selector:

```typescript
// apps/web/app/dashboard/settings/ai-providers/page.tsx
const PROVIDER_OPTIONS = [
  { value: 'claude-agent-sdk', label: 'Claude Agent SDK' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'my-provider', label: 'My Provider' }, // ← Add here
];
```

---

## Testing Providers

### Unit Testing

Test provider initialization and connection:

```typescript
import { MyProvider } from './my-provider';

describe('MyProvider', () => {
  it('should initialize successfully', async () => {
    const provider = new MyProvider();

    await provider.initialize({
      provider: 'my-provider',
      apiKey: 'test-key',
      model: 'test-model',
    });

    expect(provider.isReady()).toBe(true);
  });

  it('should test connection', async () => {
    const provider = new MyProvider();

    await provider.initialize({
      provider: 'my-provider',
      apiKey: 'valid-key',
      model: 'test-model',
    });

    const result = await provider.testConnection();
    expect(result).toBe(true);
  });
});
```

### Integration Testing

Use the test script:

```bash
# Test single provider
pnpm exec tsx scripts/test-ai-providers.ts my-provider

# Test all providers
pnpm exec tsx scripts/test-ai-providers.ts all
```

### Manual Testing via UI

1. Start development server: `pnpm dev`
2. Navigate to **Settings → AI Providers**
3. Click **Add Provider**
4. Select your provider and enter API key
5. Click **Test Connection**
6. Upload a project and select your provider for analysis

---

## API Reference

### `IAIProvider` Interface

#### `initialize(config: AIProviderConfig): Promise<void>`

Initialize the provider with configuration.

**Parameters:**

- `config.provider` - Provider type identifier
- `config.apiKey` - API key for the provider
- `config.model` - (Optional) Model to use
- `config.baseUrl` - (Optional) Custom API endpoint

**Throws:** Error if API key is invalid or connection fails

**Example:**

```typescript
await provider.initialize({
  provider: 'groq',
  apiKey: 'gsk_...',
  model: 'llama-3.3-70b-versatile',
});
```

---

#### `testConnection(): Promise<boolean>`

Test if the provider can connect to the API.

**Returns:** `true` if connection succeeds, `false` otherwise

**Example:**

```typescript
const isConnected = await provider.testConnection();
if (!isConnected) {
  console.error('Failed to connect to API');
}
```

---

#### `analyzeProject(context: ProjectContext): Promise<ProjectAnalysisResult>`

Analyze a project to detect frameworks, dependencies, and integrations.

**Parameters:**

- `context.projectPath` - Absolute path to project directory
- `context.projectName` - Name of the project
- `context.onProgress` - (Optional) Callback for progress updates

**Returns:** Analysis result with framework, dependencies, integrations, etc.

**Example:**

```typescript
const analysis = await provider.analyzeProject({
  projectPath: '/path/to/project',
  projectName: 'my-app',
  onProgress: async (progress) => {
    console.log(progress.message);
  },
});

console.log(`Framework: ${analysis.framework.name}`);
console.log(`Dependencies: ${analysis.dependencies.length}`);
```

---

#### `generateDeploymentConfig(request: DeploymentConfigRequest): Promise<DeploymentConfigResult>`

Generate deployment configurations (Dockerfile, k8s manifests, etc.).

**Parameters:**

- `request.configType` - Type of config ('docker', 'kubernetes', 'vercel', etc.)
- `request.projectAnalysis` - Previous analysis result
- `request.options` - (Optional) Additional options

**Returns:** Configuration files and instructions

**Example:**

```typescript
const config = await provider.generateDeploymentConfig({
  configType: 'docker',
  projectAnalysis: analysis,
  options: {
    includeCompose: true,
  },
});

console.log(`Generated ${config.files.length} files`);
```

---

#### `chat(request: AICompletionRequest): Promise<AICompletionResponse>`

Send a chat/completion request (no tools).

**Parameters:**

- `request.messages` - Array of chat messages
- `request.maxTokens` - (Optional) Max tokens to generate
- `request.temperature` - (Optional) Sampling temperature (0-1)

**Returns:** Completion response with content and usage stats

**Example:**

```typescript
const response = await provider.chat({
  messages: [{ role: 'user', content: 'Explain this code' }],
  maxTokens: 500,
  temperature: 0.7,
});

console.log(response.content);
```

---

### `BaseToolProvider` Class

Base class for tool-based providers. Extend this for most new providers.

#### Abstract Methods (Must Implement)

```typescript
abstract getLanguageModel(): Promise<LanguageModel>
abstract testConnection(): Promise<boolean>
abstract getAvailableModels(): Promise<string[]>
```

#### Inherited Methods (Auto-Implemented)

```typescript
initialize(config: AIProviderConfig): Promise<void>
analyzeProject(context: ProjectContext): Promise<ProjectAnalysisResult>
generateDeploymentConfig(request: DeploymentConfigRequest): Promise<DeploymentConfigResult>
chat(request: AICompletionRequest): Promise<AICompletionResponse>
isReady(): boolean
```

---

## Best Practices

### 1. API Key Validation

Always validate API key format in `testConnection()`:

```typescript
async testConnection(): Promise<boolean> {
  if (!this.config?.apiKey) {
    return false;
  }

  // Validate format
  if (!this.config.apiKey.startsWith('expected-prefix-')) {
    console.error('Invalid API key format');
    return false;
  }

  // Test with actual API call
  try {
    // ... make test request
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}
```

### 2. Error Handling

Provide clear error messages:

```typescript
try {
  // ... API call
} catch (error: any) {
  if (error.response?.status === 401) {
    throw new Error('Invalid API key. Please check your credentials.');
  } else if (error.response?.status === 429) {
    throw new Error('Rate limit exceeded. Please try again later.');
  } else {
    throw new Error(`API error: ${error.message}`);
  }
}
```

### 3. Timeouts

Always use timeouts for network requests:

```typescript
const response = await Promise.race([
  fetch('https://api.example.com/test', {
    headers: { Authorization: `Bearer ${apiKey}` },
  }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 10000)),
]);
```

### 4. Model Defaults

Provide sensible default models:

```typescript
async getLanguageModel(): Promise<LanguageModel> {
  const model = this.config!.model || 'recommended-model-id';
  return client(model);
}
```

### 5. Progress Reporting

Report progress during long operations (handled automatically by `BaseToolProvider`):

```typescript
// Users see:
// "Reading package.json..."
// "Searching for imports..."
// "Finding configuration files..."
```

### 6. Security

- **Never log API keys**: Use `console.error` for errors, not `console.log(apiKey)`
- **Validate paths**: Always use `isPathSafe()` when accessing files
- **Sanitize input**: Validate user input before passing to AI
- **Rate limiting**: Implement exponential backoff for rate-limited APIs

### 7. Testing

Test three scenarios:

1. **Valid credentials** - Should succeed
2. **Invalid credentials** - Should fail gracefully
3. **Network issues** - Should timeout and return clear error

---

## Troubleshooting

### Provider not initialized

**Error:** `Provider not initialized`

**Cause:** Trying to use provider before calling `initialize()`

**Solution:** Always initialize before use:

```typescript
await provider.initialize(config);
const result = await provider.analyzeProject(context);
```

---

### Circular dependency in testConnection

**Error:** `Provider not initialized` during `testConnection()`

**Cause:** `testConnection()` calling methods that check `this.ready` flag

**Solution:** Don't call `this.chat()` or other methods in `testConnection()`. Make direct API calls instead:

```typescript
// ❌ BAD - Creates circular dependency
async testConnection(): Promise<boolean> {
  const result = await this.chat({ messages: [{ role: 'user', content: 'test' }] });
  return !!result.content;
}

// ✅ GOOD - Direct API call
async testConnection(): Promise<boolean> {
  const response = await fetch('https://api.example.com/test', {
    headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
  });
  return response.ok;
}
```

---

### Tools not being called

**Error:** AI returns response without using tools

**Cause:** Model doesn't support function calling or tools not passed correctly

**Solution:**

1. Verify model supports tool calling
2. Check `BaseToolProvider` is passing tools correctly
3. Update system prompt to encourage tool usage

---

## Contributing

When adding a new provider:

1. ✅ Extend `BaseToolProvider` (if possible)
2. ✅ Implement required abstract methods
3. ✅ Add to type definitions
4. ✅ Register in factory
5. ✅ Add tester class
6. ✅ Write tests
7. ✅ Update documentation
8. ✅ Test via UI

**Questions?** Open an issue or discussion on GitHub.

---

## License

This documentation is part of the DXLander project and follows the same license.
