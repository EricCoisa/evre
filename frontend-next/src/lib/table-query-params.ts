export function buildTableQueryParams(
  pagination: { pageIndex: number; pageSize: number },
  globalFilter: string,
  filters: Record<string, string>,
) {
  return {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true as const,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };
}
