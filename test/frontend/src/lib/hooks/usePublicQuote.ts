import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import type { PublicQuote } from '@/lib/types';

// Separate axios instance — no auth headers, no redirect on 401
const publicClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export function usePublicQuote(publicId: string) {
  return useQuery<PublicQuote>({
    queryKey: ['public-quote', publicId],
    queryFn: async () => {
      const { data } = await publicClient.get<PublicQuote>(
        `/public/quotes/${publicId}`,
      );
      return data;
    },
    enabled: !!publicId,
    retry: false,
  });
}

export function useAcceptQuote(publicId: string) {
  return useMutation({
    mutationFn: async () => {
      await publicClient.post(`/public/quotes/${publicId}/accept`);
    },
  });
}

export function useRejectQuote(publicId: string) {
  return useMutation({
    mutationFn: async () => {
      await publicClient.post(`/public/quotes/${publicId}/reject`);
    },
  });
}

export function useTrackPdfDownload() {
  return useMutation({
    mutationFn: async (publicId: string) => {
      await publicClient.post('/public/track', { publicId });
    },
  });
}

export interface SignQuotePayload {
  signerName: string;
  signatureImage?: string;
}

export function useSignQuote(publicId: string) {
  return useMutation({
    mutationFn: async (payload: SignQuotePayload) => {
      await publicClient.post(`/public/quotes/${publicId}/sign`, payload);
    },
  });
}
