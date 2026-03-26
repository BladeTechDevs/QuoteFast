import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { DashboardMetrics } from '@/lib/types';

export function useDashboard() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardMetrics>('/dashboard');
      return data;
    },
  });
}
