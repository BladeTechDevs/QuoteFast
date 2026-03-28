import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SignatureCanvas, SignatureCanvasRef } from './SignatureCanvas';
import { createRef } from 'react';

describe('SignatureCanvas', () => {
  let onChangeMock: ReturnType<typeof vi.fn>;
  let onClearMock: ReturnType<typeof vi.fn>;
  let mockContext: any;

  beforeEach(() => {
    onChangeMock = vi.fn();
    onClearMock = vi.fn();

    // Create fresh mock context for each test
    mockContext = {
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
    };

    // Mock canvas methods
    HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
      if (contextType === '2d') {
        return mockContext;
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
  });

  describe('Canvas Rendering', () => {
    it('should render canvas with default dimensions on desktop', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma') as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
      expect(canvas.width).toBe(500);
      expect(canvas.height).toBe(200);
    });

    it('should render canvas with default dimensions on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma') as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
      expect(canvas.width).toBe(300);
      expect(canvas.height).toBe(150);
    });

    it('should render canvas with custom dimensions when provided', () => {
      render(<SignatureCanvas onChange={onChangeMock} width={400} height={180} />);

      const canvas = screen.getByLabelText('Canvas de firma') as HTMLCanvasElement;
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(180);
    });

    it('should apply custom className to container', () => {
      const { container } = render(
        <SignatureCanvas onChange={onChangeMock} className="custom-class" />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('Placeholder Text', () => {
    it('should display placeholder text when canvas is empty', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const placeholder = screen.getByText('Dibuje su firma aquí');
      expect(placeholder).toBeInTheDocument();
      expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    });

    it('should hide placeholder text after drawing', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Simulate drawing
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      fireEvent.mouseUp(canvas);

      const placeholder = screen.queryByText('Dibuje su firma aquí');
      expect(placeholder).not.toBeInTheDocument();
    });

    it('should show placeholder text again after clearing', async () => {
      const ref = createRef<SignatureCanvasRef>();
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      fireEvent.mouseUp(canvas);

      // Clear canvas
      await act(async () => {
        ref.current?.clear();
      });

      const placeholder = screen.getByText('Dibuje su firma aquí');
      expect(placeholder).toBeInTheDocument();
    });
  });

  describe('Mouse Events', () => {
    it('should start drawing on mousedown', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });

      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalledWith(10, 10);
    });

    it('should draw stroke on mousemove while drawing', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Start drawing
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });

      // Move mouse
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });

      expect(mockContext.lineTo).toHaveBeenCalledWith(20, 20);
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('should not draw on mousemove without mousedown', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Move mouse without starting drawing
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });

      expect(mockContext.lineTo).not.toHaveBeenCalled();
    });

    it('should stop drawing on mouseup and call onChange', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Draw a stroke
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      fireEvent.mouseUp(canvas);

      expect(onChangeMock).toHaveBeenCalledWith('data:image/png;base64,mockBase64Data');
    });

    it('should stop drawing on mouseleave', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Start drawing and leave canvas
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      fireEvent.mouseLeave(canvas);

      expect(onChangeMock).toHaveBeenCalledWith('data:image/png;base64,mockBase64Data');
    });
  });

  describe('Touch Events', () => {
    it('should start drawing on touchstart', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 10, clientY: 10 }],
      });

      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalledWith(10, 10);
    });

    it('should draw stroke on touchmove while drawing', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Start drawing
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 10, clientY: 10 }],
      });

      // Move touch
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 20, clientY: 20 }],
      });

      expect(mockContext.lineTo).toHaveBeenCalledWith(20, 20);
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('should stop drawing on touchend and call onChange', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Draw a stroke
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 10, clientY: 10 }],
      });
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 20, clientY: 20 }],
      });
      fireEvent.touchEnd(canvas);

      expect(onChangeMock).toHaveBeenCalledWith('data:image/png;base64,mockBase64Data');
    });

    it('should handle touch events on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Simulate touch drawing
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 5, clientY: 5 }],
      });
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 15, clientY: 15 }],
      });
      fireEvent.touchEnd(canvas);

      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
      expect(onChangeMock).toHaveBeenCalled();
    });
  });

  describe('Clear Functionality', () => {
    it('should clear canvas when clear method is called', async () => {
      const ref = createRef<SignatureCanvasRef>();
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} onClear={onClearMock} />);

      const canvas = screen.getByLabelText('Canvas de firma') as HTMLCanvasElement;

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      fireEvent.mouseUp(canvas);

      // Clear the canvas
      await act(async () => {
        ref.current?.clear();
      });

      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
      expect(onChangeMock).toHaveBeenCalledWith(null);
      expect(onClearMock).toHaveBeenCalled();
    });

    it('should reset isEmpty state after clearing', async () => {
      const ref = createRef<SignatureCanvasRef>();
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      fireEvent.mouseUp(canvas);

      expect(ref.current?.isEmpty()).toBe(false);

      // Clear the canvas
      await act(async () => {
        ref.current?.clear();
      });

      expect(ref.current?.isEmpty()).toBe(true);
    });

    it('should call onClear callback when provided', () => {
      const ref = createRef<SignatureCanvasRef>();
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} onClear={onClearMock} />);

      ref.current?.clear();

      expect(onClearMock).toHaveBeenCalled();
    });

    it('should not throw error when onClear is not provided', () => {
      const ref = createRef<SignatureCanvasRef>();
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} />);

      expect(() => ref.current?.clear()).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label attribute on canvas', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');
      expect(canvas).toHaveAttribute('aria-label', 'Canvas de firma');
    });

    it('should have aria-hidden on placeholder text', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const placeholder = screen.getByText('Dibuje su firma aquí');
      expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have pointer-events-none on placeholder to prevent interaction', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const placeholder = screen.getByText('Dibuje su firma aquí');
      expect(placeholder).toHaveClass('pointer-events-none');
    });
  });

  describe('Canvas Context Configuration', () => {
    it('should configure canvas context with correct stroke style', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      screen.getByLabelText('Canvas de firma');

      expect(mockContext.strokeStyle).toBe('#000000');
      expect(mockContext.lineWidth).toBe(2);
      expect(mockContext.lineCap).toBe('round');
      expect(mockContext.lineJoin).toBe('round');
    });
  });

  describe('Ref Methods', () => {
    it('should expose toDataURL method via ref', () => {
      const ref = createRef<SignatureCanvasRef>();
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} />);

      const dataUrl = ref.current?.toDataURL();
      expect(dataUrl).toBe('data:image/png;base64,mockBase64Data');
    });

    it('should expose isEmpty method via ref', () => {
      const ref = createRef<SignatureCanvasRef>();
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} />);

      expect(ref.current?.isEmpty()).toBe(true);

      // Draw something
      const canvas = screen.getByLabelText('Canvas de firma');
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      fireEvent.mouseUp(canvas);

      expect(ref.current?.isEmpty()).toBe(false);
    });

    it('should expose clear method via ref', () => {
      const ref = createRef<SignatureCanvasRef>();
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} />);

      expect(ref.current?.clear).toBeDefined();
      expect(typeof ref.current?.clear).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle drawing without canvas context gracefully', () => {
      const ref = createRef<SignatureCanvasRef>();
      
      // Mock getContext to return null
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
      
      render(<SignatureCanvas ref={ref} onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Should not throw
      expect(() => {
        fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
        fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
        fireEvent.mouseUp(canvas);
      }).not.toThrow();
    });

    it('should handle touch events without touches array', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Touch event without touches
      expect(() => {
        fireEvent.touchStart(canvas, { touches: [] });
      }).not.toThrow();
    });

    it('should not call onChange when stopping drawing without starting', () => {
      render(<SignatureCanvas onChange={onChangeMock} />);

      const canvas = screen.getByLabelText('Canvas de firma');

      // Try to stop drawing without starting
      fireEvent.mouseUp(canvas);

      expect(onChangeMock).not.toHaveBeenCalled();
    });
  });
});
