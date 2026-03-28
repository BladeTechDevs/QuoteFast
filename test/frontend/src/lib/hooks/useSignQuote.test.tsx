import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import axios from 'axios';

// Create mock post function
const mockPost = vi.fn();

// Mock axios module
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        post: mockPost,
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        request: vi.fn(),
        interceptors: {
          request: { use: vi.fn(), eject: vi.fn() },
          response: { use: vi.fn(), eject: vi.fn() },
        },
      })),
    },
  };
});

// Import after mocking
const { useSignQuote, SignQuotePayload } = await import('./usePublicQuote');

describe('useSignQuote', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mock
    mockPost.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Successful API submission', () => {
    it('should successfully submit signature data', async () => {
      const publicId = 'test-public-id';
      const payload: SignQuotePayload = {
        signerName: 'John Doe',
        signatureImage: 'data:image/png;base64,mockBase64Data',
      };

      // Mock successful response
      mockPost.mockResolvedValue({ data: { message: 'Quote signed successfully' } });

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      // Trigger mutation
      result.current.mutate(payload);

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith(`/public/quotes/${publicId}/sign`, payload);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should transition through loading state during submission', async () => {
      const publicId = 'test-public-id';
      const payload: SignQuotePayload = {
        signerName: 'Jane Smith',
        signatureImage: 'data:image/png;base64,anotherMockData',
      };

      let resolvePost: (value: any) => void;
      const postPromise = new Promise((resolve) => {
        resolvePost = resolve;
      });

      mockPost.mockReturnValue(postPromise);

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      // Trigger mutation
      result.current.mutate(payload);

      // Should be loading
      await waitFor(() => expect(result.current.isPending).toBe(true));

      // Resolve the promise
      resolvePost!({ data: { message: 'Success' } });

      // Should complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.isPending).toBe(false);
    });
  });

  describe('Error handling for different HTTP status codes', () => {
    it('should handle 400 Bad Request error', async () => {
      const publicId = 'test-public-id';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      const errorResponse = {
        response: {
          status: 400,
          data: { error: 'Invalid signature data' },
        },
      };

      mockPost.mockRejectedValue(errorResponse);

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(errorResponse);
      expect(result.current.isSuccess).toBe(false);
    });

    it('should handle 404 Not Found error', async () => {
      const publicId = 'non-existent-id';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      const errorResponse = {
        response: {
          status: 404,
          data: { error: 'Quote not found' },
        },
      };

      mockPost.mockRejectedValue(errorResponse);

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(errorResponse);
    });

    it('should handle 409 Conflict error', async () => {
      const publicId = 'already-signed-id';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      const errorResponse = {
        response: {
          status: 409,
          data: { error: 'Quote already signed' },
        },
      };

      mockPost.mockRejectedValue(errorResponse);

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(errorResponse);
    });

    it('should handle 500 Internal Server Error', async () => {
      const publicId = 'test-public-id';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      const errorResponse = {
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      };

      mockPost.mockRejectedValue(errorResponse);

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(errorResponse);
    });

    it('should handle network error', async () => {
      const publicId = 'test-public-id';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      const networkError = {
        message: 'Network Error',
        code: 'ERR_NETWORK',
      };

      mockPost.mockRejectedValue(networkError);

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(networkError);
    });
  });

  describe('Mutation state management', () => {
    it('should start in idle state', () => {
      const publicId = 'test-public-id';

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBeUndefined();
    });

    it('should reset state when mutation is called again', async () => {
      const publicId = 'test-public-id';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      mockPost
        .mockResolvedValueOnce({ data: { message: 'Success' } })
        .mockResolvedValueOnce({ data: { message: 'Success again' } });

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      // First mutation
      result.current.mutate(payload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Second mutation
      result.current.mutate(payload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should provide mutate function', () => {
      const publicId = 'test-public-id';

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      expect(result.current.mutate).toBeDefined();
      expect(typeof result.current.mutate).toBe('function');
    });

    it('should provide mutateAsync function', () => {
      const publicId = 'test-public-id';

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      expect(result.current.mutateAsync).toBeDefined();
      expect(typeof result.current.mutateAsync).toBe('function');
    });

    it('should handle multiple rapid mutations', async () => {
      const publicId = 'test-public-id';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      mockPost.mockResolvedValue({ data: { message: 'Success' } });

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      // Trigger multiple mutations
      result.current.mutate(payload);
      result.current.mutate(payload);
      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should have called post at least once
      expect(mockPost).toHaveBeenCalled();
    });
  });

  describe('Payload validation', () => {
    it('should accept valid payload with signerName and signatureImage', async () => {
      const publicId = 'test-public-id';
      const payload: SignQuotePayload = {
        signerName: 'Valid Name',
        signatureImage: 'data:image/png;base64,validBase64',
      };

      mockPost.mockResolvedValue({ data: { message: 'Success' } });

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith(`/public/quotes/${publicId}/sign`, payload);
    });

    it('should send payload with long signer name', async () => {
      const publicId = 'test-public-id';
      const longName = 'A'.repeat(255);
      const payload: SignQuotePayload = {
        signerName: longName,
        signatureImage: 'data:image/png;base64,test',
      };

      mockPost.mockResolvedValue({ data: { message: 'Success' } });

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith(`/public/quotes/${publicId}/sign`, {
        signerName: longName,
        signatureImage: 'data:image/png;base64,test',
      });
    });

    it('should send payload with large signature image', async () => {
      const publicId = 'test-public-id';
      const largeBase64 = 'data:image/png;base64,' + 'A'.repeat(1000);
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: largeBase64,
      };

      mockPost.mockResolvedValue({ data: { message: 'Success' } });

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith(`/public/quotes/${publicId}/sign`, payload);
    });
  });

  describe('API endpoint construction', () => {
    it('should construct correct endpoint URL with publicId', async () => {
      const publicId = 'abc123xyz';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      mockPost.mockResolvedValue({ data: { message: 'Success' } });

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith('/public/quotes/abc123xyz/sign', payload);
    });

    it('should handle special characters in publicId', async () => {
      const publicId = 'test-id-with-dashes_and_underscores';
      const payload: SignQuotePayload = {
        signerName: 'Test User',
        signatureImage: 'data:image/png;base64,test',
      };

      mockPost.mockResolvedValue({ data: { message: 'Success' } });

      const { result } = renderHook(() => useSignQuote(publicId), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith(
        '/public/quotes/test-id-with-dashes_and_underscores/sign',
        payload
      );
    });
  });
});
