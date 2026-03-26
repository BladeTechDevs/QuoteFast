// Feature: signature-ui-frontend, Property 2: Continuous stroke rendering
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fc from 'fast-check';
import { SignatureCanvas, SignatureCanvasRef } from './SignatureCanvas';
import React from 'react';

/**
 * Property 2: Continuous stroke rendering
 * 
 * **Validates: Requirements 2.2**
 * 
 * For any sequence of pointer movements while the pointer is pressed,
 * the canvas should render a continuous stroke that follows the complete
 * path of the pointer movement.
 */

describe('SignatureCanvas - Property-Based Tests', () => {
  describe('Property 2: Continuous stroke rendering', () => {
    it('should render continuous strokes for any sequence of pointer movements', () => {
      fc.assert(
        fc.property(
          // Generate sequences of pointer movements
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 500 }),
              y: fc.integer({ min: 0, max: 200 }),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (pointerSequence) => {
            // Setup
            const onChange = vi.fn();
            const ref = React.createRef<SignatureCanvasRef>();
            
            const { container } = render(
              <SignatureCanvas
                ref={ref}
                onChange={onChange}
                width={500}
                height={200}
              />
            );

            const canvas = container.querySelector('canvas') as HTMLCanvasElement;
            expect(canvas).toBeTruthy();

            const ctx = canvas.getContext('2d');
            expect(ctx).toBeTruthy();

            // Mock the canvas context methods to track drawing operations
            const beginPathCalls: number[] = [];
            const moveToPoints: Array<{ x: number; y: number }> = [];
            const lineToPoints: Array<{ x: number; y: number }> = [];
            const strokeCalls: number[] = [];

            const originalBeginPath = ctx!.beginPath.bind(ctx);
            const originalMoveTo = ctx!.moveTo.bind(ctx);
            const originalLineTo = ctx!.lineTo.bind(ctx);
            const originalStroke = ctx!.stroke.bind(ctx);

            ctx!.beginPath = vi.fn(() => {
              beginPathCalls.push(Date.now());
              originalBeginPath();
            });

            ctx!.moveTo = vi.fn((x: number, y: number) => {
              moveToPoints.push({ x, y });
              originalMoveTo(x, y);
            });

            ctx!.lineTo = vi.fn((x: number, y: number) => {
              lineToPoints.push({ x, y });
              originalLineTo(x, y);
            });

            ctx!.stroke = vi.fn(() => {
              strokeCalls.push(Date.now());
              originalStroke();
            });

            // Simulate pointer down at first point
            const firstPoint = pointerSequence[0];
            const mouseDownEvent = new MouseEvent('mousedown', {
              clientX: firstPoint.x,
              clientY: firstPoint.y,
              bubbles: true,
            });
            Object.defineProperty(mouseDownEvent, 'target', {
              value: canvas,
              enumerable: true,
            });
            canvas.dispatchEvent(mouseDownEvent);

            // Simulate pointer movements for remaining points
            for (let i = 1; i < pointerSequence.length; i++) {
              const point = pointerSequence[i];
              const mouseMoveEvent = new MouseEvent('mousemove', {
                clientX: point.x,
                clientY: point.y,
                bubbles: true,
              });
              Object.defineProperty(mouseMoveEvent, 'target', {
                value: canvas,
                enumerable: true,
              });
              canvas.dispatchEvent(mouseMoveEvent);
            }

            // Simulate pointer up
            const mouseUpEvent = new MouseEvent('mouseup', {
              bubbles: true,
            });
            canvas.dispatchEvent(mouseUpEvent);

            // Verify continuous stroke rendering properties:
            
            // 1. beginPath should be called exactly once (start of stroke)
            expect(beginPathCalls.length).toBe(1);

            // 2. moveTo should be called exactly once with the first point
            expect(moveToPoints.length).toBe(1);
            expect(moveToPoints[0].x).toBeCloseTo(firstPoint.x, 0);
            expect(moveToPoints[0].y).toBeCloseTo(firstPoint.y, 0);

            // 3. lineTo should be called for each subsequent point in the sequence
            expect(lineToPoints.length).toBe(pointerSequence.length - 1);

            // 4. Each lineTo point should match the corresponding pointer position
            for (let i = 0; i < lineToPoints.length; i++) {
              const expectedPoint = pointerSequence[i + 1];
              expect(lineToPoints[i].x).toBeCloseTo(expectedPoint.x, 0);
              expect(lineToPoints[i].y).toBeCloseTo(expectedPoint.y, 0);
            }

            // 5. stroke should be called for each movement (continuous rendering)
            expect(strokeCalls.length).toBe(pointerSequence.length - 1);

            // 6. onChange should be called once when drawing completes
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith(expect.stringContaining('data:image/png;base64,'));

            // 7. Canvas should not be empty after drawing
            expect(ref.current?.isEmpty()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle touch events for continuous stroke rendering', () => {
      fc.assert(
        fc.property(
          // Generate sequences of touch movements
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 300 }),
              y: fc.integer({ min: 0, max: 150 }),
            }),
            { minLength: 2, maxLength: 15 }
          ),
          (touchSequence) => {
            // Setup
            const onChange = vi.fn();
            const ref = React.createRef<SignatureCanvasRef>();
            
            const { container } = render(
              <SignatureCanvas
                ref={ref}
                onChange={onChange}
                width={300}
                height={150}
              />
            );

            const canvas = container.querySelector('canvas') as HTMLCanvasElement;
            expect(canvas).toBeTruthy();

            const ctx = canvas.getContext('2d');
            expect(ctx).toBeTruthy();

            // Mock the canvas context methods
            const lineToPoints: Array<{ x: number; y: number }> = [];
            const originalLineTo = ctx!.lineTo.bind(ctx);

            ctx!.lineTo = vi.fn((x: number, y: number) => {
              lineToPoints.push({ x, y });
              originalLineTo(x, y);
            });

            // Simulate touch start at first point
            const firstPoint = touchSequence[0];
            const touchStartEvent = new TouchEvent('touchstart', {
              touches: [
                {
                  clientX: firstPoint.x,
                  clientY: firstPoint.y,
                } as Touch,
              ] as any,
              bubbles: true,
            });
            canvas.dispatchEvent(touchStartEvent);

            // Simulate touch movements
            for (let i = 1; i < touchSequence.length; i++) {
              const point = touchSequence[i];
              const touchMoveEvent = new TouchEvent('touchmove', {
                touches: [
                  {
                    clientX: point.x,
                    clientY: point.y,
                  } as Touch,
                ] as any,
                bubbles: true,
              });
              canvas.dispatchEvent(touchMoveEvent);
            }

            // Simulate touch end
            const touchEndEvent = new TouchEvent('touchend', {
              touches: [] as any,
              bubbles: true,
            });
            canvas.dispatchEvent(touchEndEvent);

            // Verify continuous stroke rendering for touch
            // lineTo should be called for each point after the first
            expect(lineToPoints.length).toBe(touchSequence.length - 1);

            // Each lineTo point should follow the touch sequence
            for (let i = 0; i < lineToPoints.length; i++) {
              const expectedPoint = touchSequence[i + 1];
              expect(lineToPoints[i].x).toBeCloseTo(expectedPoint.x, 0);
              expect(lineToPoints[i].y).toBeCloseTo(expectedPoint.y, 0);
            }

            // onChange should be called once
            expect(onChange).toHaveBeenCalledTimes(1);

            // Canvas should not be empty
            expect(ref.current?.isEmpty()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not render strokes when pointer is not pressed', () => {
      fc.assert(
        fc.property(
          // Generate sequences of pointer movements without pressing
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 500 }),
              y: fc.integer({ min: 0, max: 200 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (pointerSequence) => {
            // Setup
            const onChange = vi.fn();
            const ref = React.createRef<SignatureCanvasRef>();
            
            const { container } = render(
              <SignatureCanvas
                ref={ref}
                onChange={onChange}
                width={500}
                height={200}
              />
            );

            const canvas = container.querySelector('canvas') as HTMLCanvasElement;
            const ctx = canvas.getContext('2d');

            // Mock lineTo to track drawing
            const lineToPoints: Array<{ x: number; y: number }> = [];
            ctx!.lineTo = vi.fn((x: number, y: number) => {
              lineToPoints.push({ x, y });
            });

            // Simulate pointer movements WITHOUT pressing down
            for (const point of pointerSequence) {
              const mouseMoveEvent = new MouseEvent('mousemove', {
                clientX: point.x,
                clientY: point.y,
                bubbles: true,
              });
              canvas.dispatchEvent(mouseMoveEvent);
            }

            // Verify no drawing occurred
            expect(lineToPoints.length).toBe(0);
            expect(onChange).not.toHaveBeenCalled();
            expect(ref.current?.isEmpty()).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
