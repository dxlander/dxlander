# Playwright E2E tests

This folder contains Playwright end-to-end test scaffolding for critical user flows.

Environment variables used by the tests:

- E2E_BASE_URL (optional) — overrides the base URL from Playwright config (for example, `https://staging.dxlander.dev`)
- E2E_EMAIL, E2E_PASSWORD — credentials used for the auth flow (for example, `test@example.com` and `password123`)
- E2E_GITHUB_REPO — repository `owner/name` used in the import flow (optional, for example, `dxlander/dxlander`)
- E2E_PROJECT_ID — project id to run analysis/configs/deploy tests against (optional — copy the project id from the app after import)

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

## Debugging

To inspect failures locally:

```bash
# Run with Playwright UI mode for interactive debugging
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --ui

# Generate and open the HTML report
pnpm exec playwright show-report
```

Common issues:

- If tests time out, confirm the target app is reachable at `E2E_BASE_URL`.
- Verify selectors match the current UI—inspect the rendered HTML when the test pauses.
- When using saved auth state, review `tests/e2e/.auth/storageState.json` to confirm credentials succeeded.
