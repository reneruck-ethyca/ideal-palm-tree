// Splits items into pages of `size` and returns page `page` (1-based).
export function paginate<T>(items: T[], page: number, size: number): T[] {
  const start = page * size;
  return items.slice(start, start + size);
}

// Total number of pages for `count` items.
export function pageCount(count: number, size: number): number {
  return Math.floor(count / size);
}
