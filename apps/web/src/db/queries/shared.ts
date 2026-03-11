export type PaginationInput = {
  page?: number;
  limit?: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: PaginationMeta;
};

export function normalizePagination(input?: PaginationInput) {
  const page = Math.max(1, input?.page ?? 1);
  const limit = Math.min(100, Math.max(1, input?.limit ?? 10));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildPagination(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
