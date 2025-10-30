# Playwright E2E tests

This folder contains Playwright end-to-end test scaffolding for critical user flows.

Environment variables used by the tests:

- E2E_BASE_URL (optional) — overrides the base URL from Playwright config
- E2E_EMAIL, E2E_PASSWORD — credentials used for the auth flow
- E2E_GITHUB_REPO — repository `owner/name` used in the import flow (optional)
- E2E_PROJECT_ID — project id to run analysis/configs/deploy tests against (optional)

Run locally (after installing deps):

```bash
# install deps
pnpm install

# install playwright browsers (one-time)
pnpm exec playwright install --with-deps

# run tests in headed mode
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --headed

# CI friendly run
pnpm run test:e2e:playwright:ci
```

Notes:

- Tests contain a mixture of smoke checks and environment-driven tests; many are skipped unless the required env var is present. Adapt selectors to match the web app's UI.
- When credentials are provided, the Playwright global setup logs in once and shares the stored session with every test.
- These tests assume the app under test is reachable at `E2E_BASE_URL` or `http://localhost:3000`.
