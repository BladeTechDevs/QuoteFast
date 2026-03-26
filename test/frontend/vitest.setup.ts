import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock HTMLCanvasElement methods for testing
HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
  if (contextType === '2d') {
    return {
      fillStyle: '',
      strokeStyle: '#000000',
      lineWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
    } as any;
  }
  return null;
});

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mockBase64Data');
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  top: 0,
  left: 0,
  right: 500,
  bottom: 200,
  width: 500,
  height: 200,
  x: 0,
  y: 0,
  toJSON: () => {},
}));
