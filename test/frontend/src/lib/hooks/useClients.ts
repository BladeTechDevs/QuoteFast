import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Client, PaginatedResponse } from '@/lib/types';

export function useClients() {
  return useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Client>>('/clients', {
        params: { limit: 100 },
      });
      return data;
    },
  });
}

export interface ClientFormData {
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ClientFormData) => {
      const { data } = await apiClient.post<Client>('/clients', dto);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Partial<ClientFormData>) => {
      const { data } = await apiClient.patch<Client>(`/clients/${id}`, dto);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/clients/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}
