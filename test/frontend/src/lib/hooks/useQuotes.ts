import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Quote, PaginatedResponse, QuoteStatus } from '@/lib/types';

export interface QuotesFilters {
  status?: QuoteStatus | '';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useQuotes(filters: QuotesFilters = {}) {
  const {
    status,
    search,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  return useQuery<PaginatedResponse<Quote>>({
    queryKey: ['quotes', { status, search, page, limit, sortBy, sortOrder }],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit,
        sortBy,
        sortOrder,
      };
      if (status) params.status = status;
      if (search) params.search = search;
      const { data } = await apiClient.get<PaginatedResponse<Quote>>('/quotes', { params });
      return data;
    },
  });
}
