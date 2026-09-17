import assert from "node:assert/strict";
import test from "node:test";

import { paginate } from "./pagination.ts";

test("paginate slices items into pages", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  const page0 = paginate(items, 0, 10);
  assert.equal(page0.total, 25);
  assert.ok(page0.items.length <= 10);
  assert.equal(page0.items[0], 0);
});

test("paginate reports the requested page and size", () => {
  const items = Array.from({ length: 5 }, (_, i) => i);
  const result = paginate(items, 1, 2);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 2);
});
