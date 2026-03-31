import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Notification } from '@/lib/types';

const POLL_INTERVAL = 30_000; // 30 seconds

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get<Notification[]>('/notifications');
      return data;
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: 10_000,
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return data;
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: 10_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
