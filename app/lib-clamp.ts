export function clampPage(page: number, pageCount: number): number {
  if (page < 1) return 0;
  if (page > pageCount) return pageCount + 1;
  return page;
}

export function sliceItems<T>(items: T[], page: number, size: number): T[] {
  return items.slice(page * size, page * size + size);
}
