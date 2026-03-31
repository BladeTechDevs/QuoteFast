import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listQuoteTemplates,
  createQuoteTemplate,
  updateQuoteTemplate,
  deleteQuoteTemplate,
  saveQuoteAsTemplate,
  type QuoteTemplateFormData,
} from '@/lib/api/quote-templates';

export function useQuoteTemplates() {
  return useQuery({
    queryKey: ['quote-templates'],
    queryFn: listQuoteTemplates,
  });
}

export function useCreateQuoteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: QuoteTemplateFormData) => createQuoteTemplate(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-templates'] }),
  });
}

export function useUpdateQuoteTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<QuoteTemplateFormData>) => updateQuoteTemplate(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-templates'] }),
  });
}

export function useDeleteQuoteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuoteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-templates'] }),
  });
}

export function useSaveQuoteAsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, name }: { quoteId: string; name: string }) =>
      saveQuoteAsTemplate(quoteId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-templates'] }),
  });
}
