'use client';

import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface SignatureCanvasProps {
  onChange: (dataUrl: string | null) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  className?: string;
}

export interface SignatureCanvasRef {
  clear: () => void;
  toDataURL: () => string;
  isEmpty: () => boolean;
}

export const SignatureCanvas = forwardRef<SignatureCanvasRef, SignatureCanvasProps>(
  ({ onChange, onClear, width, height, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    // Get pointer position from mouse or touch event
    const getPointerPosition = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e instanceof TouchEvent && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        return null;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    // Start drawing
    const startDrawing = (e: MouseEvent | TouchEvent) => {
      const pos = getPointerPosition(e);
      if (!pos) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    // Draw stroke
    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;

      const pos = getPointerPosition(e);
      if (!pos) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    // Stop drawing
    const stopDrawing = () => {
      if (!isDrawing) return;

      setIsDrawing(false);
      setIsEmpty(false);

      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        onChange(dataUrl);
      }
    };

    // Clear canvas
    const clear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
      onChange(null);
      onClear?.();
    };

    // Convert to data URL
    const toDataURL = (): string => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      return canvas.toDataURL('image/png');
    };

    // Check if canvas is empty
    const checkIsEmpty = (): boolean => {
      return isEmpty;
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      clear,
      toDataURL,
      isEmpty: checkIsEmpty,
    }));

    // Set up canvas context and event listeners
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Configure drawing style
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Mouse event handlers
      const handleMouseDown = (e: MouseEvent) => startDrawing(e);
      const handleMouseMove = (e: MouseEvent) => draw(e);
      const handleMouseUp = () => stopDrawing();
      const handleMouseLeave = () => stopDrawing();

      // Touch event handlers
      const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        startDrawing(e);
      };
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        draw(e);
      };
      const handleTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        stopDrawing();
      };

      // Add event listeners
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('mouseleave', handleMouseLeave);
      canvas.addEventListener('touchstart', handleTouchStart);
      canvas.addEventListener('touchmove', handleTouchMove);
      canvas.addEventListener('touchend', handleTouchEnd);

      // Cleanup
      return () => {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      };
    }, [isDrawing]);

    // Determine responsive dimensions
    const canvasWidth = width || (typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 500);
    const canvasHeight = height || (typeof window !== 'undefined' && window.innerWidth < 640 ? 150 : 200);

    return (
      <div className={clsx('relative', className)}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          aria-label="Canvas de firma"
          className={clsx(
            'border-2 border-gray-300 rounded-md touch-none',
            'w-full max-w-full h-auto',
          )}
          style={{
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
          }}
        />
        {isEmpty && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-sm"
            aria-hidden="true"
          >
            Dibuje su firma aquí
          </div>
        )}
      </div>
    );
  }
);

SignatureCanvas.displayName = 'SignatureCanvas';
