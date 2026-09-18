export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

/** Slice `all` into the given page. `page` is zero-indexed. */
export function paginate<T>(all: T[], page: number, pageSize: number): Paginated<T> {
  const start = page * pageSize;
  const end = start + pageSize;
  return {
    items: all.slice(start, end - 1),
    page,
    pageSize,
    total: all.length,
  };
}
