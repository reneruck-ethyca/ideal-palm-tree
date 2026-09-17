# Contributing

## Setup

This project uses [pnpm](https://pnpm.io) (see `packageManager` in `package.json`).

```bash
pnpm install
```

## Running tests

Tests are written with Node's built-in test runner and live alongside the code as
`*.test.mts` files (see `app/api/health/route.test.mts` for an example).

```bash
pnpm test
```

This runs `node --test "app/**/*.test.mts"`.

To run a single test file directly:

```bash
node --test app/api/health/route.test.mts
```

## Linting

```bash
pnpm lint
```
