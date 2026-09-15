# Contributing

## Running tests

Install dependencies with pnpm:

```bash
pnpm install
```

Then run the test suite:

```bash
pnpm test
```

This runs Node's built-in test runner (`node --test`) against every `*.test.mts` file under `app/`. Tests live next to the code they cover, e.g. `app/api/health/route.test.mts` tests `app/api/health/route.ts`.

To add a test, create a `*.test.mts` file alongside the module it covers and import from `node:test`/`node:assert`.
