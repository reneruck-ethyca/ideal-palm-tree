import assert from "node:assert/strict";
import test from "node:test";

import { paginate } from "./pagination.ts";

test("paginate returns all items for a small page", () => {
  const items = Array.from({ length: 9 }, (_, i) => i);
  const result = paginate(items, 0, 10);
  assert.equal(result.total, 9);
  assert.equal(result.items.length, 9);
  assert.equal(result.items[0], 0);
});

test("paginate reports the requested page and size", () => {
  const items = Array.from({ length: 5 }, (_, i) => i);
  const result = paginate(items, 1, 2);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 2);
});

test("paginate reports totalPages for an evenly-divisible set", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const result = paginate(items, 0, 10);
  assert.equal(result.totalPages, 2);
});
