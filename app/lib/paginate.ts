// Splits items into pages of `size` and returns page `page` (1-based).
export function paginate<T>(items: T[], page: number, size: number): T[] {
  if (page < 1 || size <= 0) return [];
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

// Total number of pages for `count` items.
export function pageCount(count: number, size: number): number {
  if (size <= 0) return 0;
  return Math.ceil(count / size);
}
