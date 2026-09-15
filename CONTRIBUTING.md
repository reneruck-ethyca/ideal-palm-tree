# Contributing

## Running the tests

Tests use Node's built-in test runner (`node:test`) against `.test.mts` files under `app/`. No dependency install is required to run the existing tests, since they exercise plain `Response` handlers directly rather than booting Next.js.

Run the full suite with:

```bash
npm test
```

This runs `node --test "app/**/*.test.mts"`.

To run a single test file directly:

```bash
node --test app/api/health/route.test.mts
```

### Adding tests

Co-locate test files next to the code they cover, named `*.test.mts` (e.g. `app/api/health/route.test.mts` tests `app/api/health/route.ts`). Prefer testing route handlers as plain functions (returning a standard `Response`) over importing `next/server`, so tests can call them directly without starting the Next.js server.
