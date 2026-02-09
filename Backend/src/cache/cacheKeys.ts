export const cacheKeys = {
  tokenList: (page: number, limit: number, sort: string) => `tokens:list:${sort}:${page}:${limit}`,
  tokenDetail: (id: string) => `tokens:detail:${id}`
} as const;
