import { z } from 'zod';

/**
 * AI Provider Testing Types
 *
 * Types for testing AI provider connections and configurations.
 */

/**
 * AI Provider test configuration
 *
 * @example
 * ```typescript
 * const config: ProviderTestConfig = {
 *   provider: "claude-code",
 *   apiKey: "sk-ant-...",
 *   settings: {
 *     model: "claude-sonnet-4-5-20250929",
 *   },
 * };
 * ```
 */
export const ProviderTestConfigSchema = z.object({
  provider: z.string().min(1, 'Provider name is required'),
  apiKey: z.string().optional(),
  settings: z
    .object({
      model: z.string().optional(),
      baseUrl: z.string().optional(),
    })
    .catchall(z.any())
    .optional(),
});
export type ProviderTestConfig = z.infer<typeof ProviderTestConfigSchema>;

/**
 * AI Provider test result
 *
 * @example
 * ```typescript
 * const result: ProviderTestResult = {
 *   success: true,
 *   message: "Successfully connected to Claude Agent SDK",
 *   model: "claude-sonnet-4-5-20250929",
 *   details: {
 *     provider: "claude-code",
 *     timestamp: "2025-11-09T12:00:00Z",
 *   },
 * };
 * ```
 */
export const ProviderTestResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  model: z.string(),
  details: z.record(z.any()),
});
export type ProviderTestResult = z.infer<typeof ProviderTestResultSchema>;
