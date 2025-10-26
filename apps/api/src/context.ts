import type { Context } from '@dxlander/shared';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import type { Context as HonoContext } from 'hono';

export function createContext(opts: FetchCreateContextFnOptions, c: HonoContext): Context {
  // Get user from Hono context (set by auth middleware)
  const user = c.get('user') as { id: string; email: string; role: string } | undefined;

  return {
    userId: user?.id,
    req: opts.req,
  };
}
