'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { BrandingSettings } from '@/lib/types';

export function useBranding() {
  return useQuery<BrandingSettings>({
    queryKey: ['branding'],
    queryFn: async () => {
      const { data } = await apiClient.get<BrandingSettings>('/branding');
      return data;
    },
  });
}

export function useUpdateBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<BrandingSettings>) => {
      const { data } = await apiClient.put<BrandingSettings>('/branding', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
    },
  });
}
