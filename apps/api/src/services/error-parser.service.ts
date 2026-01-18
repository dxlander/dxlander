import { randomUUID } from 'crypto';
import type {
  DeploymentError,
  DeploymentErrorType,
  DeploymentErrorStage,
  ErrorLocation,
  FixSuggestion,
  ErrorAnalysis,
} from '@dxlander/shared';

/**
 * Error pattern for matching Docker/build output
 *
 * NOTE: These patterns match ERROR OUTPUT from Docker/build tools,
 * NOT project types. Docker error formats are standardized,
 * so pattern matching on output is acceptable and maintainable.
 */
interface ErrorPattern {
  pattern: RegExp;
  type: DeploymentErrorType;
  extractMessage?: (match: RegExpMatchArray, fullOutput: string) => string;
  extractLocation?: (match: RegExpMatchArray, fullOutput: string) => ErrorLocation | undefined;
}

/**
 * Error Parser Service
 *
 * Parses raw deployment error output into structured error objects.
 * This enables AI-assisted error recovery by providing actionable information.
 *
 * DESIGN PRINCIPLE: We parse ERROR OUTPUT from Docker/build tools (standardized formats),
 * NOT project structure (which would require hardcoded language detection).
 */
export class ErrorParserService {
  /**
   * Common error patterns from Docker and build tools
   * These are OUTPUT patterns, not INPUT detection
   */
  private static readonly ERROR_PATTERNS: ErrorPattern[] = [
    // Dockerfile syntax errors
    {
      pattern: /failed to solve:.*dockerfile parse error/i,
      type: 'dockerfile_invalid',
      extractMessage: (match, output) => {
        const lineMatch = output.match(/line (\d+):/i);
        return lineMatch
          ? `Dockerfile syntax error on line ${lineMatch[1]}`
          : 'Dockerfile syntax error';
      },
      extractLocation: (match, output) => {
        const lineMatch = output.match(/line (\d+):/i);
        return lineMatch ? { file: 'Dockerfile', line: parseInt(lineMatch[1]) } : undefined;
      },
    },

    // Docker build step failures (with line number from Dockerfile)
    {
      pattern: /Dockerfile:(\d+)\s*[->\s]*.*\n.*(?:failed|error|exit code)/i,
      type: 'build_failed',
      extractMessage: (match, output) => {
        const cmdMatch = output.match(/>>>\s*(RUN|COPY|ADD|CMD|ENTRYPOINT)\s+(.+)/i);
        return cmdMatch
          ? `Build failed at: ${cmdMatch[1]} ${cmdMatch[2].slice(0, 100)}`
          : `Build failed at Dockerfile line ${match[1]}`;
      },
      extractLocation: (match) => ({
        file: 'Dockerfile',
        line: parseInt(match[1]),
      }),
    },

    // Generic build process failure
    {
      pattern: /failed to solve:.*did not complete successfully.*exit code:\s*(\d+)/i,
      type: 'build_failed',
      extractMessage: (match) => `Build process failed with exit code ${match[1]}`,
    },

    // npm/yarn/pnpm errors
    {
      pattern: /npm ERR!.*ENOENT/i,
      type: 'dependency_missing',
      extractMessage: () => 'npm could not find a required file or package',
    },
    {
      pattern: /npm ERR!.*ERESOLVE/i,
      type: 'dependency_conflict',
      extractMessage: (match, output) => {
        const pkgMatch = output.match(/Could not resolve dependency.*\n.*peer\s+(\S+)/i);
        return pkgMatch
          ? `Dependency conflict with ${pkgMatch[1]}`
          : 'npm dependency resolution conflict';
      },
    },
    {
      pattern: /npm ERR! code E404/i,
      type: 'dependency_missing',
      extractMessage: (match, output) => {
        const pkgMatch = output.match(/npm ERR! 404.*'([^']+)'/);
        return pkgMatch ? `Package not found: ${pkgMatch[1]}` : 'npm package not found';
      },
    },

    // Docker Compose errors
    {
      pattern: /yaml:\s*(line\s+\d+:|.*did not find expected)/i,
      type: 'compose_invalid',
      extractMessage: (match) => `docker-compose.yml YAML error: ${match[0].slice(0, 100)}`,
      extractLocation: (match, output) => {
        const lineMatch = output.match(/line\s+(\d+)/i);
        return lineMatch ? { file: 'docker-compose.yml', line: parseInt(lineMatch[1]) } : undefined;
      },
    },
    {
      pattern: /services\.[^:]+:\s+Additional property.*not allowed/i,
      type: 'compose_invalid',
      extractMessage: (match) =>
        `Invalid property in docker-compose.yml: ${match[0].slice(0, 100)}`,
    },

    // Image errors
    {
      pattern: /manifest.*not found|image.*not found|pull access denied/i,
      type: 'image_not_found',
      extractMessage: (match, output) => {
        const imageMatch = output.match(
          /(?:manifest|image)\s+(?:for\s+)?["']?([^"'\s]+)["']?.*not found/i
        );
        return imageMatch ? `Docker image not found: ${imageMatch[1]}` : 'Docker image not found';
      },
    },
    {
      pattern: /error.*pulling.*image|failed to pull/i,
      type: 'image_pull_failed',
      extractMessage: () => 'Failed to pull Docker image from registry',
    },

    // Port conflicts
    {
      pattern: /bind:.*address already in use|port.*already allocated/i,
      type: 'port_conflict',
      extractMessage: (match, output) => {
        const portMatch = output.match(/(?:port|:)(\d+)/i);
        return portMatch ? `Port ${portMatch[1]} is already in use` : 'Port conflict detected';
      },
    },

    // Resource errors
    {
      pattern: /OOM|out of memory|memory.*exceeded|killed/i,
      type: 'memory_exceeded',
      extractMessage: () => 'Container ran out of memory',
    },
    {
      pattern: /no space left on device|disk.*full/i,
      type: 'disk_full',
      extractMessage: () => 'No disk space available',
    },

    // Permission errors
    {
      pattern: /permission denied|EACCES|access denied/i,
      type: 'permission_denied',
      extractMessage: (match, output) => {
        const fileMatch = output.match(/permission denied.*['"]([^'"]+)['"]/i);
        return fileMatch ? `Permission denied: ${fileMatch[1]}` : 'Permission denied';
      },
    },

    // Network errors
    {
      pattern: /network.*unreachable|connection.*refused|ECONNREFUSED|ETIMEDOUT/i,
      type: 'network_error',
      extractMessage: () => 'Network connection failed',
    },

    // Timeout
    {
      pattern: /timeout|timed out|deadline exceeded/i,
      type: 'timeout',
      extractMessage: () => 'Operation timed out',
    },

    // Environment variable errors
    {
      pattern: /environment variable.*not set|missing.*env|undefined.*variable/i,
      type: 'env_var_missing',
      extractMessage: (match, output) => {
        const varMatch = output.match(/(?:variable|env)\s+['"]?(\w+)['"]?/i);
        return varMatch
          ? `Missing environment variable: ${varMatch[1]}`
          : 'Required environment variable not set';
      },
    },

    // Healthcheck failures
    {
      pattern: /health.*check.*fail|unhealthy/i,
      type: 'healthcheck_failed',
      extractMessage: () => 'Container healthcheck failed',
    },

    // Generic startup failure
    {
      pattern: /exited with code [1-9]|container.*stopped|failed to start/i,
      type: 'startup_failed',
      extractMessage: (match, output) => {
        const codeMatch = output.match(/exited with code (\d+)/i);
        return codeMatch
          ? `Container exited with code ${codeMatch[1]}`
          : 'Container failed to start';
      },
    },
  ];

  /**
   * Parse raw deployment error output into structured error
   */
  static parseError(
    rawOutput: string,
    stage: DeploymentErrorStage,
    deploymentId: string
  ): DeploymentError {
    const now = new Date();

    // Try to match against known patterns
    for (const pattern of this.ERROR_PATTERNS) {
      const match = rawOutput.match(pattern.pattern);
      if (match) {
        return {
          id: randomUUID(),
          deploymentId,
          type: pattern.type,
          stage,
          message: pattern.extractMessage?.(match, rawOutput) || match[0].slice(0, 200),
          location: pattern.extractLocation?.(match, rawOutput),
          context: this.extractContext(rawOutput, match.index || 0),
          rawError: rawOutput,
          exitCode: this.extractExitCode(rawOutput),
          timestamp: now,
        };
      }
    }

    // Fallback to unknown error type (AI will analyze)
    return {
      id: randomUUID(),
      deploymentId,
      type: 'unknown',
      stage,
      message: this.extractFirstError(rawOutput) || 'Unknown deployment error',
      context: this.extractContext(rawOutput, 0),
      rawError: rawOutput,
      exitCode: this.extractExitCode(rawOutput),
      timestamp: now,
    };
  }

  /**
   * Generate basic fix suggestions for an error
   * These are deterministic suggestions; AI can provide more sophisticated ones
   */
  static generateBasicSuggestions(error: DeploymentError): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    switch (error.type) {
      case 'build_failed':
        suggestions.push({
          id: randomUUID(),
          description: 'Review the build command in Dockerfile',
          confidence: 'medium',
          type: 'file_edit',
          details: {
            file: 'Dockerfile',
            instructions: error.location
              ? `Check line ${error.location.line} of the Dockerfile`
              : 'Review the RUN commands in Dockerfile',
          },
        });
        break;

      case 'dockerfile_invalid':
        suggestions.push({
          id: randomUUID(),
          description: 'Fix Dockerfile syntax',
          confidence: 'high',
          type: 'file_edit',
          details: {
            file: 'Dockerfile',
            instructions: error.location
              ? `Fix syntax error on line ${error.location.line}`
              : 'Review Dockerfile for syntax errors',
          },
        });
        break;

      case 'compose_invalid':
        suggestions.push({
          id: randomUUID(),
          description: 'Fix docker-compose.yml syntax',
          confidence: 'high',
          type: 'file_edit',
          details: {
            file: 'docker-compose.yml',
            instructions: error.location
              ? `Fix YAML error on line ${error.location.line}`
              : 'Review docker-compose.yml for YAML syntax errors',
          },
        });
        break;

      case 'dependency_missing':
        suggestions.push({
          id: randomUUID(),
          description: 'Check package.json or requirements file for missing dependencies',
          confidence: 'medium',
          type: 'manual',
          details: {
            instructions:
              'Verify all dependencies are listed in your package manager configuration',
          },
        });
        break;

      case 'dependency_conflict':
        suggestions.push({
          id: randomUUID(),
          description: 'Resolve dependency version conflicts',
          confidence: 'medium',
          type: 'manual',
          details: {
            instructions: 'Check for conflicting peer dependencies and update versions accordingly',
          },
        });
        break;

      case 'port_conflict':
        suggestions.push({
          id: randomUUID(),
          description: 'Change the port mapping to avoid conflict',
          confidence: 'high',
          type: 'config_change',
          details: {
            instructions:
              'Modify the port mapping in docker-compose.yml to use a different host port',
          },
        });
        break;

      case 'image_not_found':
        suggestions.push({
          id: randomUUID(),
          description: 'Verify the Docker image name and tag',
          confidence: 'high',
          type: 'file_edit',
          details: {
            file: 'Dockerfile',
            instructions: 'Check the FROM instruction for correct image name and tag',
          },
        });
        break;

      case 'env_var_missing':
        suggestions.push({
          id: randomUUID(),
          description: 'Add the missing environment variable',
          confidence: 'high',
          type: 'env_var',
          details: {
            instructions: 'Add the required environment variable in the deployment configuration',
          },
        });
        break;

      case 'permission_denied':
        suggestions.push({
          id: randomUUID(),
          description: 'Fix file permissions in Dockerfile',
          confidence: 'medium',
          type: 'file_edit',
          details: {
            file: 'Dockerfile',
            instructions: 'Add appropriate chmod/chown commands or run as non-root user',
          },
        });
        break;

      case 'memory_exceeded':
        suggestions.push({
          id: randomUUID(),
          description: 'Increase container memory limit',
          confidence: 'high',
          type: 'file_edit',
          details: {
            file: 'docker-compose.yml',
            instructions: 'Add or increase mem_limit in the service definition',
          },
        });
        break;

      case 'timeout':
        suggestions.push({
          id: randomUUID(),
          description: 'Increase build or startup timeout',
          confidence: 'medium',
          type: 'config_change',
          details: {
            instructions:
              'The build process is taking longer than expected. Consider optimizing the build or increasing the timeout.',
          },
        });
        break;

      default:
        // For unknown errors, suggest AI analysis
        suggestions.push({
          id: randomUUID(),
          description: 'Use AI to analyze and fix this error',
          confidence: 'medium',
          type: 'manual',
          details: {
            instructions: 'Click "Fix with AI" to have the AI analyze this error and suggest fixes',
          },
        });
    }

    return suggestions;
  }

  /**
   * Create a full error analysis
   */
  static analyzeError(
    rawOutput: string,
    stage: DeploymentErrorStage,
    deploymentId: string
  ): ErrorAnalysis {
    const error = this.parseError(rawOutput, stage, deploymentId);
    const suggestedFixes = this.generateBasicSuggestions(error);
    const possibleCauses = this.getPossibleCauses(error);

    return {
      error,
      possibleCauses,
      suggestedFixes,
      aiAnalysisAvailable: true,
    };
  }

  /**
   * Get possible causes for an error type
   */
  private static getPossibleCauses(error: DeploymentError): string[] {
    const causesMap: Partial<Record<DeploymentErrorType, string[]>> = {
      build_failed: [
        'Build command in Dockerfile failed to execute',
        'Missing dependencies not installed before build',
        'Incorrect working directory in Dockerfile',
        'Build script error in the application code',
      ],
      dockerfile_invalid: [
        'Invalid Dockerfile syntax',
        'Unsupported Dockerfile instruction',
        'Missing required instruction (FROM, etc.)',
      ],
      compose_invalid: [
        'YAML syntax error in docker-compose.yml',
        'Invalid property name (check for Kubernetes-only properties)',
        'Missing required fields in service definition',
      ],
      dependency_missing: [
        'Package not listed in dependencies',
        'Private package without authentication',
        'Typo in package name',
        'Package removed from registry',
      ],
      dependency_conflict: [
        'Conflicting peer dependency versions',
        'Node.js version incompatibility',
        'Lock file out of sync with package.json',
      ],
      port_conflict: [
        'Another container or process is using this port',
        'Previous deployment not properly cleaned up',
        'Host firewall blocking the port',
      ],
      image_not_found: [
        'Typo in image name or tag',
        'Image was removed from registry',
        'Private registry without authentication',
        'Architecture mismatch (amd64 vs arm64)',
      ],
      env_var_missing: [
        'Required environment variable not configured',
        'Typo in environment variable name',
        'Secret not properly linked to deployment',
      ],
      permission_denied: [
        'File ownership issues in container',
        'Running as non-root without proper permissions',
        'Volume mount permission issues',
      ],
      memory_exceeded: [
        'Application memory leak',
        'Container memory limit too low',
        'Large build process exhausting memory',
      ],
      timeout: [
        'Slow network causing image pull timeout',
        'Large codebase taking too long to build',
        'Application hanging during startup',
      ],
      unknown: [
        'Unable to automatically determine the cause',
        'AI analysis may provide more insight',
      ],
    };

    return causesMap[error.type] || ['Unknown cause - AI analysis recommended'];
  }

  /**
   * Extract context lines around the error
   */
  private static extractContext(output: string, matchIndex: number): string[] {
    const lines = output.split('\n');
    const lineIndex = output.slice(0, matchIndex).split('\n').length - 1;
    const startIndex = Math.max(0, lineIndex - 3);
    const endIndex = Math.min(lines.length, lineIndex + 7);

    return lines.slice(startIndex, endIndex).filter((line) => line.trim());
  }

  /**
   * Extract first error-like message from output
   *
   * This method tries to find the most relevant error message from build output.
   * It filters out false positives like informational messages.
   */
  private static extractFirstError(output: string): string | null {
    // Split output into lines and search for error-like lines
    const lines = output.split('\n');

    // Keywords that indicate informational/non-error messages
    const falsePositivePatterns = [
      /easier to read/i,
      /for more information/i,
      /learn how to/i,
      /visit https?:/i,
      /docker scan/i,
      /snyk tests/i,
    ];

    // Look for lines that contain error keywords at the start
    const errorLinePatterns = [
      /^(?:>?\s*)?(?:\[\d+\/\d+\]\s+)?(?:ERROR|Error|error)[\s:]+(.+)/,
      /^(?:>?\s*)?(?:FAILED|Failed|failed)[\s:]+(.+)/,
      /^(?:>?\s*)?(?:FATAL|Fatal|fatal)[\s:]+(.+)/,
      /^(?:>?\s*)?npm ERR!\s*(.+)/,
      /^(?:>?\s*)?failed to solve:\s*(.+)/i,
      /^(?:>?\s*)?exit code:\s*(\d+)/i,
    ];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Skip false positive lines
      const isFalsePositive = falsePositivePatterns.some((p) => p.test(trimmedLine));
      if (isFalsePositive) continue;

      // Check if line matches error patterns
      for (const pattern of errorLinePatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          const errorMessage = match[1]?.trim();
          if (errorMessage && errorMessage.length > 5) {
            return errorMessage.slice(0, 200);
          }
        }
      }
    }

    // Fallback: look for "failed to solve" anywhere in output
    const failedMatch = output.match(/failed to solve[^.]*\.\s*([^.]+)/i);
    if (failedMatch && failedMatch[1]) {
      return failedMatch[1].trim().slice(0, 200);
    }

    // Last resort: find last line with meaningful error content
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.length > 20 && (line.includes('error') || line.includes('failed'))) {
        const isFalsePositive = falsePositivePatterns.some((p) => p.test(line));
        if (!isFalsePositive) {
          return line.slice(0, 200);
        }
      }
    }

    return null;
  }

  /**
   * Extract exit code from output
   */
  private static extractExitCode(output: string): number | undefined {
    const match = output.match(/exit(?:ed with)?\s*(?:code|status)?\s*[:\s]*(\d+)/i);
    return match ? parseInt(match[1]) : undefined;
  }
}
