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
    // Use refs for drawing state to avoid stale closures in event handlers
    const isDrawingRef = useRef(false);
    const isEmptyRef = useRef(true);
    const [isEmpty, setIsEmpty] = useState(true);
    // Keep latest callbacks in refs to avoid re-registering listeners
    const onChangeRef = useRef(onChange);
    const onClearRef = useRef(onClear);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    useEffect(() => { onClearRef.current = onClear; }, [onClear]);

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

    // Clear canvas
    const clear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      isEmptyRef.current = true;
      setIsEmpty(true);
      onChangeRef.current(null);
      onClearRef.current?.();
    };

    // Convert to data URL
    const toDataURL = (): string => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      return canvas.toDataURL('image/png');
    };

    // Check if canvas is empty
    const checkIsEmpty = (): boolean => {
      return isEmptyRef.current;
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      clear,
      toDataURL,
      isEmpty: checkIsEmpty,
    }));

    // Set up canvas context and event listeners (only once on mount)
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

      // Start drawing
      const startDrawing = (e: MouseEvent | TouchEvent) => {
        const pos = getPointerPosition(e);
        if (!pos) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        isDrawingRef.current = true;
        context.beginPath();
        context.moveTo(pos.x, pos.y);
      };

      // Draw stroke
      const draw = (e: MouseEvent | TouchEvent) => {
        if (!isDrawingRef.current) return;
        const pos = getPointerPosition(e);
        if (!pos) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.lineTo(pos.x, pos.y);
        context.stroke();
      };

      // Stop drawing
      const stopDrawing = () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        isEmptyRef.current = false;
        setIsEmpty(false);
        const dataUrl = canvas.toDataURL('image/png');
        onChangeRef.current(dataUrl);
      };

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
    }, []); // Empty deps - register once on mount

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
