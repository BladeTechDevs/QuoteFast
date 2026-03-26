import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { QuoteDetail, QuoteItem } from '@/lib/types';

export function useQuoteDetail(id: string) {
  return useQuery<QuoteDetail>({
    queryKey: ['quote', id],
    queryFn: async () => {
      const { data } = await apiClient.get<QuoteDetail>(`/quotes/${id}`);
      return data;
    },
    enabled: !!id && id !== 'new',
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      clientId?: string;
      currency?: string;
      taxRate?: number;
      discount?: number;
      notes?: string;
      terms?: string;
      validUntil?: string;
    }) => {
      const { data } = await apiClient.post<QuoteDetail>('/quotes', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useUpdateQuote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<{
      title: string;
      clientId: string | null;
      currency: string;
      taxRate: number;
      discount: number;
      notes: string;
      terms: string;
      validUntil: string | null;
    }>) => {
      const { data } = await apiClient.patch<QuoteDetail>(`/quotes/${id}`, payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quote', id], data);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useCreateQuoteItem(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      quantity: number;
      unitPrice: number;
      order?: number;
    }) => {
      const { data } = await apiClient.post<QuoteItem>(`/quotes/${quoteId}/items`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
    },
  });
}

export function useUpdateQuoteItem(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, ...payload }: {
      itemId: string;
      name?: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
      order?: number;
    }) => {
      const { data } = await apiClient.patch<QuoteItem>(`/quotes/${quoteId}/items/${itemId}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
    },
  });
}

export function useDeleteQuoteItem(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      await apiClient.delete(`/quotes/${quoteId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
    },
  });
}

export function useSendQuote(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post(`/quotes/${quoteId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}
