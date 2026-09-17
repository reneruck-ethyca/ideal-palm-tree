# Deployment Guide

This document describes a hypothetical process for deploying this app to a
generic Node.js hosting provider (e.g. a VM, a container platform, or a PaaS
like Render/Railway/Fly.io — anything that can run a long-lived Node process
behind a reverse proxy). It intentionally avoids Vercel-specific tooling so
the steps transfer to any host that gives you a shell and a process manager.

## 1. Why "generic Node hosting" needs its own process

Next.js's `next build` produces a standalone-capable server, not a static
site (this app has a server-rendered route and an API route under
`app/api/health`, so it cannot be exported as static HTML). That means the
target host must:

- Run a persistent Node.js process (`next start`), not just serve static
  files.
- Expose that process on a port the host's reverse proxy/load balancer
  forwards traffic to.
- Restart the process automatically on crash or redeploy.

This is the reasoning behind every choice below: we're building an artifact
that's just a Node app, and treating the host as "a place that runs `node`
and proxies HTTP to it."

## 2. Runtime requirements

| Requirement | Value | Why |
|---|---|---|
| Node.js | 20.x LTS or newer | `package.json` devDependencies pin `@types/node@^20`, and Next.js 16 requires a current Node LTS. Use the same major version in CI, build, and runtime to avoid native-module ABI mismatches. |
| Package manager | pnpm (`packageManager: pnpm@11.15.1` in `package.json`) | The project ships a `pnpm-lock.yaml`, not a `package-lock.json` or `yarn.lock`. Installing with a different package manager would ignore the lockfile and could resolve different dependency versions than what was tested. |
| OS packages | none beyond a standard Node build image | No native addons or system libraries are referenced in `package.json`; a plain `node:20-slim`-class image is sufficient. |

## 3. Environment variables

The app does not currently read any `process.env` values in application
code — it's a fresh `create-next-app` project with a single UI page and a
`GET /api/health` route. That will change as real features are added, so
the process below is written for "the general case of a Next.js app on a
generic host," with placeholders called out explicitly.

### 3.1 Variables Next.js itself understands

These aren't custom to this app, but the hosting provider must set them
because Next.js reads them at build and/or start time:

- `NODE_ENV=production` — tells Next.js (and React) to build/run in
  production mode (minified output, no dev warnings, no HMR). Most hosts
  set this automatically; set it explicitly if yours doesn't.
- `PORT` — the port `next start` binds to. Most Node hosts inject this and
  expect the app to honor it (`next start -p $PORT`). Do not hardcode a
  port in code or config, since the host chooses it dynamically.
- `HOSTNAME` — optional; some hosts require binding to `0.0.0.0` rather
  than the default. Pass via `next start -H 0.0.0.0` if the platform's
  health checks fail to reach the app on the default bind address.

### 3.2 Application-specific variables (placeholders)

None exist yet. When this app grows a database, auth provider, or external
API integration, add each variable here with:

- its purpose,
- whether it's required at **build time** (Next.js inlines `NEXT_PUBLIC_*`
  variables into the client bundle at build time — changing them requires a
  rebuild, not just a restart) or **runtime only** (server-only variables,
  read in Server Components/Route Handlers, can change without a rebuild),
  and
- where it's sourced from (the host's secret store, not committed to git).

Example of how a future entry should look, once such a variable exists:

```
DATABASE_URL   runtime-only   Postgres connection string   set in host's secret manager
NEXT_PUBLIC_API_BASE_URL   build-time   base URL the client fetches from   safe to expose to the browser
```

The distinction between build-time and runtime variables matters because
it changes the deployment procedure: a runtime-only variable can be
rotated with just a process restart, while a `NEXT_PUBLIC_*` variable
requires a full rebuild and redeploy to take effect.

### 3.3 Secrets handling

`.gitignore` already excludes `.env*` files, so local `.env.local` files
used for development never reach the repository. On the host, set
environment variables through the provider's secret/environment
configuration UI or CLI (not committed files), and never echo secret
values into build logs.

## 4. Build steps

```bash
# 1. Install dependencies exactly as locked
pnpm install --frozen-lockfile

# 2. Run the test suite (fail the deploy if this fails)
pnpm test

# 3. Lint (optional gate, but cheap and catches obvious issues)
pnpm lint

# 4. Produce the production build
pnpm build

# 5. Start the production server
pnpm start
```

Reasoning for each step:

1. **`--frozen-lockfile`**: guarantees the exact dependency graph that was
   tested is what gets deployed, and fails loudly if `package.json` and
   `pnpm-lock.yaml` have drifted (e.g. someone added a dependency without
   committing the updated lockfile) rather than silently re-resolving.
2. **`pnpm test`**: this repo uses Node's built-in test runner
   (`node --test "app/**/*.test.mts"`, see `app/api/health/route.test.mts`).
   Running it in the build pipeline — not just locally — catches
   regressions before they reach production. There's no separate CI config
   in this repo, so the hosting provider's build step is the only gate
   unless one is added.
3. **`pnpm lint`**: not strictly required to produce a working build, but
   `eslint-config-next` catches Next.js-specific footguns (e.g. using
   `<img>` instead of `next/image`, or breaking the App Router's
   server/client boundary). Treat lint failures as a deploy blocker or a
   warning depending on how strict the team wants to be.
4. **`pnpm build`** (`next build`): compiles and optimizes the app,
   generates the `.next/` output directory, and performs static analysis
   Next.js needs to decide which routes are static vs. dynamic. This step
   needs any `NEXT_PUBLIC_*` variables already set, since they're baked
   into the client bundle here, not at start time.
5. **`pnpm start`** (`next start`): runs the actual production server.
   This is the long-lived process the host should supervise (restart on
   crash, run under the process's assigned `$PORT`).

### 4.1 Optional: standalone output for smaller deploys

If the host bills by image size or you're deploying via a container, add
to `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
};
```

This makes `next build` emit a minimal `.next/standalone` directory
containing only the production `node_modules` subset actually needed at
runtime, which you then run with `node .next/standalone/server.js`
instead of `pnpm start`. This is called out as *optional* rather than
folded into the main steps above because it changes the start command and
is only worth the complexity if image size/cold start time is a concern
(e.g. container-based hosts with per-MB costs), which isn't yet known to
apply here.

## 5. Process supervision

Whatever process manager the host uses (systemd, PM2, a platform-native
supervisor, etc.), it should:

- Run `pnpm start` (or the standalone `server.js`, if using that output
  mode) as the long-lived process.
- Restart on non-zero exit.
- Route the platform's health check at `/api/health` (already implemented
  in `app/api/health/route.ts`, returning `{ status: "ok", time }`) rather
  than `/`, since the health endpoint has no dependency on rendering the
  full page and responds even if something else on the page is broken.

## 6. Rollback strategy

Because `next build` output is deterministic given the same source and
lockfile, the simplest rollback is: keep the previous build artifact (or
redeploy the previous git commit) and re-run steps 1–5 above. Avoid
patching a running deployment in place — always roll forward/back through
a full build so the deployed `.next/` output never diverges from a known
git commit.

## 7. What's deliberately out of scope here

- **CDN/static asset caching**: `public/` assets and Next's automatically
  fingerprinted build output are cacheable indefinitely; configure the
  host's static file caching accordingly once real static assets exist
  beyond `favicon.ico`.
- **Database migrations, TLS termination, autoscaling**: not applicable
  yet — this app has no database and no documented traffic profile. Add a
  section here when those become real.
