import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Template } from '@/lib/types';

export function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<Template[]>('/templates');
      return data;
    },
  });
}

export interface TemplateFormData {
  name: string;
  content: {
    currency?: string;
    taxRate?: number;
    discount?: number;
    notes?: string;
    terms?: string;
  };
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: TemplateFormData) => {
      const { data } = await apiClient.post<Template>('/templates', dto);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Partial<TemplateFormData>) => {
      const { data } = await apiClient.patch<Template>(`/templates/${id}`, dto);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/templates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}
