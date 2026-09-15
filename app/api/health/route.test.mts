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
