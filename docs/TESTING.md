# Testing

This document explains how tests in this repo work, walks through the one test file
that exists today, and shows how to add a new test. It's meant to be enough context
that you don't need to reverse-engineer the setup from `package.json` every time.

## TL;DR

```bash
pnpm test
```

That runs:

```bash
node --test "app/**/*.test.mts"
```

There is no Jest, Vitest, or other test framework installed. Tests run on Node's
built-in test runner (`node:test`), and TypeScript files are executed directly —
no build or transpile step.

## Why this setup

The project (`pampers-jumpo`) is a small Next.js 16 app. At the time this doc was
written it has exactly one route (`/api/health`) and one page. Given how small the
app is, the test setup was kept equally minimal rather than pulling in a full test
framework:

- **`node:test` instead of Jest/Vitest** — Node ships a test runner and an
  assertion library (`node:assert`) out of the box. For a project this size that's
  one less dependency to install, configure, and keep patched. `node --test` also
  discovers, runs, and reports tests (TAP output) without any config file.
- **`.mts` test files, run directly by Node** — This repo is on Node 22 (see
  `node --version`), which can execute TypeScript files directly by stripping
  type annotations at load time (no `ts-node`, `tsx`, or `babel-register`
  required). `.mts` is used (rather than `.ts`) to force ESM semantics
  unambiguously, matching `"type": "module"` in `package.json`. You can confirm
  this works in this checkout by running `node --test "app/**/*.test.mts"`
  directly — no build step runs first.
- **Route handlers as plain functions** — `app/api/health/route.ts` is written so
  its `GET` export is just a plain async function returning a standard
  `Response`/`Request` Web API object, with no import from `next/server`. That's a
  deliberate choice (see the comment at the top of the file) so tests can call
  `GET()` directly in a plain Node process, without spinning up the Next.js dev
  server or using a heavier integration-testing tool. If a route needs
  `next/server`-only APIs (e.g. `NextRequest`/`NextResponse` features, cookies,
  middleware-specific behavior), this direct-call approach won't work as-is and
  you'd need a different strategy (see "Limitations" below).

In short: tests are plain Node scripts that import application code and call it
directly, run by `node --test`, with TypeScript handled natively by Node.

## How test discovery works

`node --test "app/**/*.test.mts"` glob-matches every file under `app/` (at any
depth) whose name ends in `.test.mts`. Node's test runner:

1. Loads each matching file as an ES module.
2. Executes any top-level `test(...)` calls registered via `node:test`.
3. Collects pass/fail/skip results and prints a TAP report, then a summary
   (`# tests`, `# pass`, `# fail`, etc.) to stdout.
4. Exits non-zero if any test fails — this is what makes `pnpm test` a proper
   CI-style gate.

There is no separate test config file (no `.mocharc`, no `vitest.config.ts`, no
`jest.config.js`). The entire configuration is the glob pattern in the `test`
script in `package.json`:

```json
"scripts": {
  "test": "node --test \"app/**/*.test.mts\""
}
```

Convention in this repo is to **colocate** a test file next to the source file it
tests, using the `<name>.test.mts` suffix (e.g. `route.ts` → `route.test.mts` in
the same directory). There's no separate `__tests__/` or top-level `tests/`
directory — keep new tests colocated the same way unless there's a strong reason
not to.

## Walkthrough of the existing test

### The code under test — `app/api/health/route.ts`

```ts
// ponytail: the whole backend. Plain web Response, no next/server import, so the
// test can call GET() directly without booting Next.
export async function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
```

This is a Next.js App Router [Route Handler](https://nextjs.org/docs/app/api-reference/file-conventions/route).
Next.js will call `GET` automatically for `GET /api/health` requests when the app
is running. But because it's just an exported async function using the global
`Response` object (available in Node without any polyfill), tests can import and
call it exactly like any other function.

### The test — `app/api/health/route.test.mts`

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "./route.ts";

test("GET /api/health returns ok with a timestamp", async () => {
  const res = await GET();
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.ok(!Number.isNaN(Date.parse(body.time)), `bad timestamp: ${body.time}`);
});
```

Breaking down the pieces:

- `import test from "node:test";` — the built-in test runner. `test(name, fn)`
  registers one test case. `fn` can be `async`; the runner awaits it and fails
  the test if the returned promise rejects or an assertion throws.
- `import assert from "node:assert/strict";` — Node's strict assertion module
  (`assert.equal` behaves like `assert.strictEqual`, `assert.ok` throws on any
  falsy value, etc.). There's no separate expectation/matcher library
  (no `expect(...).toBe(...)`) — everything goes through `node:assert`.
- `import { GET } from "./route.ts";` — note the import specifier has a literal
  `.ts` extension, not `.js` or extensionless. This is required because Node's
  native TypeScript support resolves relative specifiers as written — since the
  source file is `route.ts`, the import must say `route.ts`. This mirrors
  `allowImportingTsExtensions: true` in `tsconfig.json`, which permits `.ts`
  extensions in import specifiers for tooling (TypeScript/ESLint) that would
  otherwise complain.
- The test body calls `GET()` directly (no HTTP request/response objects need to
  be constructed — this handler takes no arguments), then asserts:
  - the response status is `200`,
  - the JSON body has `status: "ok"`,
  - `body.time` parses as a valid date (`Date.parse` returns `NaN` for garbage
    input, so `!Number.isNaN(...)` confirms it's a real, parseable timestamp —
    deliberately not asserting an exact value, since the timestamp is
    generated at call time).

Run just this file directly if you want to iterate on it in isolation:

```bash
node --test app/api/health/route.test.mts
```

## How to add a new test

1. **Put the test next to the code it exercises.** If you're testing
   `app/api/widgets/route.ts`, create `app/api/widgets/route.test.mts` in the same
   directory. The `.test.mts` suffix is what makes `node --test` pick it up via
   the glob in `package.json` — get the suffix wrong (e.g. `.test.ts` or
   `.spec.mts`) and it silently won't run.

2. **Import what you're testing with an explicit source extension.** Since Node
   resolves the specifier as written, import `./route.ts`, not `./route` or
   `./route.js`. This matches the existing test and works because of
   `allowImportingTsExtensions` in `tsconfig.json`.

3. **Write one or more `test(...)` blocks:**

   ```ts
   import assert from "node:assert/strict";
   import test from "node:test";

   import { GET } from "./route.ts";

   test("describes the expected behavior", async () => {
     const res = await GET(/* args if the handler takes any */);
     assert.equal(res.status, 200);
     // ...more assertions
   });
   ```

   You can register multiple `test(...)` calls in one file, and/or group related
   cases with `describe`/`it` if you prefer that style — both are supported by
   `node:test` (`import { describe, it } from "node:test";`). This repo's
   existing test uses the flatter `test(...)` style; match that unless you have a
   good reason for nested suites.

4. **Keep handlers testable the way `route.ts` does it.** If you're adding a new
   route handler, prefer writing it against the standard Web `Request`/`Response`
   APIs (as the health route does) rather than `next/server`'s `NextRequest`/
   `NextResponse`, when the extra features aren't needed. That keeps the handler
   callable directly from a test with no server boot required. If you do need
   `next/server`-specific behavior, see "Limitations" below before assuming the
   same direct-call pattern will work.

5. **Run it:**

   ```bash
   pnpm test
   # or, to run just your new file while iterating:
   node --test path/to/your.test.mts
   ```

   Confirm the new test shows up in the TAP output (`# Subtest: <your test
   name>`) and that the final summary shows the expected `# tests` count — an
   easy mistake is a typo in the filename suffix that causes the runner to skip
   the file entirely without any error.

6. **Avoid non-erasable TypeScript syntax in test files (and app code).** Node's
   native TypeScript support only *strips* type syntax; it doesn't compile
   things that have runtime behavior. Concretely, avoid in `.mts`/`.ts` files run
   directly by Node:
   - `enum` (including `const enum`)
   - `namespace`/`module` blocks containing values
   - parameter properties (`constructor(private x: string)`)
   - legacy import/export assignment (`import foo = require(...)`)

   Stick to plain types, interfaces, type aliases, generics, and `as`/`satisfies`
   assertions — all erasable, all fine. If in doubt, run the file directly with
   `node --test <file>` and Node will error clearly if it hits non-erasable
   syntax.

## Assertions cheat sheet (`node:assert/strict`)

Commonly useful ones (full list in the [Node docs](https://nodejs.org/api/assert.html)):

| Call | Checks |
|---|---|
| `assert.equal(a, b)` | `a === b` (strict, despite the name — this is the `/strict` module) |
| `assert.notEqual(a, b)` | `a !== b` |
| `assert.deepEqual(a, b)` | Deep structural equality (objects/arrays) |
| `assert.ok(value)` | `value` is truthy |
| `assert.throws(fn)` | `fn()` throws |
| `assert.rejects(promise)` | `promise` rejects |
| `assert.match(str, regex)` | String matches a regex |

## Test lifecycle helpers

`node:test` supports `before`, `after`, `beforeEach`, `afterEach` for setup/teardown,
and `test.skip(...)` / `test.todo(...)` for marking tests as skipped or pending.
None of these are used yet in this repo, but they're available:

```ts
import { after, before, test } from "node:test";

before(() => {
  // runs once before all tests in this file
});

after(() => {
  // runs once after all tests in this file
});
```

## Limitations / things not set up yet

Worth knowing so you don't assume more coverage exists than actually does:

- **No React/component testing.** `app/page.tsx` (the client component that
  fetches `/api/health` and renders the result) has no test. `node:test` runs in
  a plain Node environment — there's no DOM, no React renderer, and no
  `@testing-library/react` / `jsdom` dependency installed. If you need to test a
  component, you'd first need to add those dependencies and wire up a DOM
  environment; that isn't part of the current setup.
- **No true HTTP/integration tests.** Existing tests call route handler exports
  directly as functions; nothing boots a real Next.js server and makes an actual
  HTTP request against it. That means behavior that only manifests through
  Next.js's routing/middleware layer (redirects, headers Next adds itself,
  `next/server` cookie handling, etc.) isn't exercised.
- **No coverage reporting.** `node --test` supports coverage via
  `--experimental-test-coverage`, but the `test` script doesn't enable it. Add
  the flag locally if you want a coverage report:
  ```bash
  node --test --experimental-test-coverage "app/**/*.test.mts"
  ```
- **No CI workflow.** There's no `.github/workflows` (or similar) directory in
  this repo, so `pnpm test` isn't currently run automatically anywhere — it's a
  local/manual gate for now.
