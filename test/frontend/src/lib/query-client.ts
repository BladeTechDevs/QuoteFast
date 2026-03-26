import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        retry: (failureCount, error: unknown) => {
          // Don't retry on 401/403/404
          const status = (error as { response?: { status?: number } })?.response
            ?.status;
          if (status === 401 || status === 403 || status === 404) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
