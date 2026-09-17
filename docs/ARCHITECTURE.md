# Architecture

`pampers-jumpo` is a minimal Next.js 16 application using the App Router. It is
intentionally small: one page, one API route, and no database, auth, or
external services. This document explains how the pieces fit together and why
they're built the way they are.

## App structure

```
app/
  layout.tsx        # root layout: fonts, global CSS, <html>/<body> shell
  page.tsx           # client component rendered at "/"
  globals.css        # Tailwind base styles
  favicon.ico
  api/
    health/
      route.ts       # GET /api/health
      route.test.mts # unit test for the handler above
```

Next's App Router maps the filesystem under `app/` directly to routes:

- A `page.tsx` in a directory renders the UI for that URL path. `app/page.tsx`
  is the only page, so it owns `/`.
- A `layout.tsx` wraps every page beneath it. `app/layout.tsx` is the root
  layout, so it wraps the whole app. It loads the Geist fonts via
  `next/font/google`, exposes them as CSS variables, sets the page
  `<html>`/`<body>` shell, and imports `globals.css` (Tailwind) once for the
  entire app.
- A `route.ts` in a directory defines an API endpoint (a "Route Handler")
  instead of a page. Handlers export functions named after HTTP verbs
  (`GET`, `POST`, etc.); Next calls the one matching the incoming request.
  `app/api/health/route.ts` therefore serves `GET /api/health`.

There's no `app/api/health/page.tsx` — a route segment is either a page or a
route handler (or both, for different purposes), and `health` only needs the
handler.

### The one page (`app/page.tsx`)

`page.tsx` is a **client component** (`"use client"` at the top), not a server
component, because it needs `useState`/`useEffect` to call the health
endpoint *from the browser* after mount and render the result. This is
deliberate: it's a small, visible proof that the frontend can actually reach
the backend over HTTP, rather than the server reading its own health state
in-process. If the fetch fails (route missing, server down, non-2xx status),
the page shows the error message it caught instead of throwing, so the UI
degrades to "backend unreachable" rather than crashing.

## API routes under `app/api`

There is currently one API route: `app/api/health`. The convention for adding
more is the same one Next.js uses throughout the App Router: create
`app/api/<name>/route.ts` and export the HTTP-verb functions you need
(`GET`, `POST`, `PUT`, `DELETE`, ...). Each route handler:

- Receives a standard web `Request` (optionally) and must return a standard
  web `Response` (or the `NextResponse` subclass, which isn't needed here).
- Is server-only code — it runs in Node (or the configured runtime), never
  shipped to the browser bundle.
- Is reachable at the URL matching its path under `app/api`, e.g.
  `app/api/health/route.ts` → `/api/health`.

Keeping route handlers as plain functions over `Request`/`Response` (rather
than reaching for framework-specific request/response types) is what makes
them testable directly, which is the point of the next section.

## How the health check endpoint works

`app/api/health/route.ts`:

```ts
export async function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
```

This is as simple as a health check gets, and that's the design:

- **No `next/server` import.** Next.js route handlers are conventionally
  written against `next/server`'s `NextRequest`/`NextResponse`, but this one
  uses only the platform-standard `Response` object (`Response.json(...)` is
  a built-in web API, not a Next.js addition). The payoff is that `GET` is a
  plain async function with no framework dependency, so it can be imported
  and called directly in a test without booting a Next.js server or mocking
  request context.
- **No request parameter.** The handler doesn't need anything from the
  incoming request — it's a liveness check, not a diagnostic endpoint — so
  it takes no arguments.
- **Two fields only.** `status: "ok"` is a fixed, trivially-greppable
  sentinel a load balancer or uptime checker can assert on. `time` is an
  ISO-8601 timestamp (`new Date().toISOString()`), included so callers can
  see whether the response is fresh and confirm the server's clock is sane;
  it's also what proves to a human — e.g. the value rendered on `/` — that
  each request is actually hitting the server anew rather than showing a
  cached response.
- **Always 200, no error branches.** There's nothing in the handler that can
  fail (no I/O, no parsing, no downstream calls), so there's no error path to
  handle. If real dependencies (a database, a queue, an upstream service)
  are added later, this is the place to add corresponding failure branches
  that return non-2xx statuses — but not before there's something that can
  actually fail.

### Why the test imports the route module directly

`app/api/health/route.test.mts`:

```ts
import { GET } from "./route.ts";

test("GET /api/health returns ok with a timestamp", async () => {
  const res = await GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.ok(!Number.isNaN(Date.parse(body.time)), `bad timestamp: ${body.time}`);
});
```

This runs under Node's built-in test runner (`node --test`, wired up as the
`test` script in `package.json`), not a browser or a running Next.js server.
Because `GET` is an ordinary function returning an ordinary `Response`, the
test can call it in-process: no HTTP server to start, no port to bind, no
network round trip. It asserts exactly the two things the contract promises:
status `200` and a `status`/`time` shaped body where `time` parses as a valid
date. This is only possible *because* the handler avoided
`next/server`-specific types — had it used `NextRequest`/`NextResponse`, the
test would need to construct or mock Next's request context instead of
calling a plain function.

### How the frontend uses it

`app/page.tsx` fetches `/api/health` on mount (relative URL, so it works
whether the app is served on `localhost:3000` or any deployed origin) and
renders one of three states: "checking", "backend unreachable: `<error>`", or
`"Backend ok · <timestamp>"`. This makes the health check double as a
same-origin connectivity smoke test visible directly on the homepage, useful
during local development or after a deploy to confirm the API route is live
without needing a separate tool.
