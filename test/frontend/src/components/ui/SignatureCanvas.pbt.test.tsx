// Feature: signature-ui-frontend, Property 2: Continuous stroke rendering
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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

// Helper to mock canvas getBoundingClientRect
const mockCanvasBoundingRect = (canvas: HTMLCanvasElement, width: number, height: number) => {
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
};

// Helper to simulate drawing on canvas
const simulateDrawing = async (
  canvas: HTMLCanvasElement,
  points: Array<{ x: number; y: number }>,
  eventType: 'mouse' | 'touch' = 'mouse'
) => {
  if (points.length < 2) return;

  if (eventType === 'mouse') {
    // Mouse down at first point
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: points[0].x,
      clientY: points[0].y,
      bubbles: true,
    });
    canvas.dispatchEvent(mouseDownEvent);

    // Mouse move for remaining points
    for (let i = 1; i < points.length; i++) {
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: points[i].x,
        clientY: points[i].y,
        bubbles: true,
      });
      canvas.dispatchEvent(mouseMoveEvent);
    }

    // Mouse up
    const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true });
    canvas.dispatchEvent(mouseUpEvent);
  } else {
    // Touch start at first point
    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [{ clientX: points[0].x, clientY: points[0].y } as Touch] as any,
      bubbles: true,
    });
    canvas.dispatchEvent(touchStartEvent);

    // Touch move for remaining points
    for (let i = 1; i < points.length; i++) {
      const touchMoveEvent = new TouchEvent('touchmove', {
        touches: [{ clientX: points[i].x, clientY: points[i].y } as Touch] as any,
        bubbles: true,
      });
      canvas.dispatchEvent(touchMoveEvent);
    }

    // Touch end
    const touchEndEvent = new TouchEvent('touchend', {
      touches: [] as any,
      bubbles: true,
    });
    canvas.dispatchEvent(touchEndEvent);
  }

  // Wait for React state updates
  await waitFor(() => {}, { timeout: 100 });
};

describe('SignatureCanvas - Property-Based Tests', () => {
  describe('Property 2: Continuous stroke rendering', () => {
    it('should render continuous strokes for any sequence of pointer movements', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate sequences of pointer movements with at least one actual movement
          fc.array(
            fc.record({
              x: fc.integer({ min: 10, max: 490 }),
              y: fc.integer({ min: 10, max: 190 }),
            }),
            { minLength: 2, maxLength: 20 }
          ).filter(seq => {
            // Ensure at least one point is different from the first
            return seq.some((point, i) => 
              i > 0 && (point.x !== seq[0].x || point.y !== seq[0].y)
            );
          }),
          async (pointerSequence) => {
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

            // Mock getBoundingClientRect to return proper canvas position
            mockCanvasBoundingRect(canvas, 500, 200);

            // Simulate drawing
            await simulateDrawing(canvas, pointerSequence, 'mouse');

            // Verify continuous stroke rendering properties:
            
            // 1. onChange should be called once when drawing completes
            await waitFor(() => {
              expect(onChange).toHaveBeenCalledTimes(1);
            });
            
            // 2. onChange should provide a valid PNG data URI
            expect(onChange).toHaveBeenCalledWith(expect.stringContaining('data:image/png;base64,'));

            // 3. Canvas should not be empty after drawing
            expect(ref.current?.isEmpty()).toBe(false);

            // 4. Canvas should contain drawn content (data URL should be non-trivial)
            const dataUrl = ref.current?.toDataURL();
            expect(dataUrl).toBeTruthy();
            expect(dataUrl).toContain('data:image/png;base64,');
            
            // Verify the data URL is not just an empty canvas
            // (empty canvas has a specific short base64 string)
            expect(dataUrl!.length).toBeGreaterThan(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle touch events for continuous stroke rendering', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate sequences of touch movements with at least one actual movement
          fc.array(
            fc.record({
              x: fc.integer({ min: 10, max: 290 }),
              y: fc.integer({ min: 10, max: 140 }),
            }),
            { minLength: 2, maxLength: 15 }
          ).filter(seq => {
            // Ensure at least one point is different from the first
            return seq.some((point, i) => 
              i > 0 && (point.x !== seq[0].x || point.y !== seq[0].y)
            );
          }),
          async (touchSequence) => {
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

            // Mock getBoundingClientRect to return proper canvas position
            mockCanvasBoundingRect(canvas, 300, 150);

            // Simulate touch drawing
            await simulateDrawing(canvas, touchSequence, 'touch');

            // Verify continuous stroke rendering for touch
            
            // 1. onChange should be called once
            await waitFor(() => {
              expect(onChange).toHaveBeenCalledTimes(1);
            });

            // 2. onChange should provide a valid PNG data URI
            expect(onChange).toHaveBeenCalledWith(expect.stringContaining('data:image/png;base64,'));

            // 3. Canvas should not be empty
            expect(ref.current?.isEmpty()).toBe(false);

            // 4. Canvas should contain drawn content
            const dataUrl = ref.current?.toDataURL();
            expect(dataUrl).toBeTruthy();
            expect(dataUrl).toContain('data:image/png;base64,');
            expect(dataUrl!.length).toBeGreaterThan(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not render strokes when pointer is not pressed', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate sequences of pointer movements without pressing
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 500 }),
              y: fc.integer({ min: 0, max: 200 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (pointerSequence) => {
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
            
            // Mock getBoundingClientRect to return proper canvas position
            mockCanvasBoundingRect(canvas, 500, 200);

            // Simulate pointer movements WITHOUT pressing down
            for (const point of pointerSequence) {
              const mouseMoveEvent = new MouseEvent('mousemove', {
                clientX: point.x,
                clientY: point.y,
                bubbles: true,
              });
              canvas.dispatchEvent(mouseMoveEvent);
            }

            // Wait a bit to ensure no async updates happen
            await waitFor(() => {}, { timeout: 50 });

            // Verify no drawing occurred
            expect(onChange).not.toHaveBeenCalled();
            expect(ref.current?.isEmpty()).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: signature-ui-frontend, Property 3: Clear erases all content
  describe('Property 3: Clear erases all content', () => {
    it('should erase all canvas content when clear is called', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary canvas states with drawn content
          fc.array(
            fc.record({
              x: fc.integer({ min: 10, max: 490 }),
              y: fc.integer({ min: 10, max: 190 }),
            }),
            { minLength: 2, maxLength: 20 }
          ).filter(seq => {
            // Ensure at least one point is different from the first
            return seq.some((point, i) => 
              i > 0 && (point.x !== seq[0].x || point.y !== seq[0].y)
            );
          }),
          async (pointerSequence) => {
            // Setup
            const onChange = vi.fn();
            const onClear = vi.fn();
            const ref = React.createRef<SignatureCanvasRef>();
            
            const { container } = render(
              <SignatureCanvas
                ref={ref}
                onChange={onChange}
                onClear={onClear}
                width={500}
                height={200}
              />
            );

            const canvas = container.querySelector('canvas') as HTMLCanvasElement;
            expect(canvas).toBeTruthy();

            // Mock getBoundingClientRect
            mockCanvasBoundingRect(canvas, 500, 200);

            // Draw arbitrary content on canvas
            await simulateDrawing(canvas, pointerSequence, 'mouse');

            // Verify onChange was called with drawing data
            await waitFor(() => {
              expect(onChange).toHaveBeenCalled();
            });

            // Get the data URL before clearing
            const dataUrlBeforeClear = onChange.mock.calls[onChange.mock.calls.length - 1][0];
            expect(dataUrlBeforeClear).toBeTruthy();
            expect(dataUrlBeforeClear).toContain('data:image/png;base64,');

            // Clear the canvas
            onChange.mockClear(); // Reset mock to track clear call
            ref.current?.clear();

            // Verify clear() results in empty canvas with no visible strokes
            
            // 1. Canvas should be empty after clear
            expect(ref.current?.isEmpty()).toBe(true);

            // 2. onChange should be called with null
            expect(onChange).toHaveBeenCalledWith(null);

            // 3. onClear callback should be called
            expect(onClear).toHaveBeenCalledTimes(1);

            // 4. Canvas data URL should represent an empty canvas
            const dataUrlAfterClear = ref.current?.toDataURL();
            expect(dataUrlAfterClear).toBeTruthy();
            
            // 5. The canvas should have no visible strokes (compare with fresh canvas)
            const freshCanvas = document.createElement('canvas');
            freshCanvas.width = 500;
            freshCanvas.height = 200;
            const freshDataUrl = freshCanvas.toDataURL('image/png');
            
            // After clearing, the canvas should match a fresh empty canvas
            expect(dataUrlAfterClear).toBe(freshDataUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple clear operations on the same canvas', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple sequences of drawing and clearing
          fc.array(
            fc.array(
              fc.record({
                x: fc.integer({ min: 10, max: 490 }),
                y: fc.integer({ min: 10, max: 190 }),
              }),
              { minLength: 2, maxLength: 10 }
            ).filter(seq => {
              return seq.some((point, i) => 
                i > 0 && (point.x !== seq[0].x || point.y !== seq[0].y)
              );
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (drawingSequences) => {
            // Setup
            const onChange = vi.fn();
            const onClear = vi.fn();
            const ref = React.createRef<SignatureCanvasRef>();
            
            const { container } = render(
              <SignatureCanvas
                ref={ref}
                onChange={onChange}
                onClear={onClear}
                width={500}
                height={200}
              />
            );

            const canvas = container.querySelector('canvas') as HTMLCanvasElement;
            mockCanvasBoundingRect(canvas, 500, 200);

            // Perform multiple draw-clear cycles
            for (let i = 0; i < drawingSequences.length; i++) {
              const sequence = drawingSequences[i];
              
              // Draw
              await simulateDrawing(canvas, sequence, 'mouse');
              
              // Verify onChange was called (indicating drawing occurred)
              await waitFor(() => {
                expect(onChange).toHaveBeenCalled();
              });

              // Clear
              ref.current?.clear();

              // Verify canvas is empty after each clear
              expect(ref.current?.isEmpty()).toBe(true);
              expect(onClear).toHaveBeenCalledTimes(i + 1);
            }

            // After all cycles, canvas should still be empty
            expect(ref.current?.isEmpty()).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should clear canvas regardless of drawing complexity', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate complex drawing patterns (multiple strokes)
          fc.array(
            fc.array(
              fc.record({
                x: fc.integer({ min: 10, max: 490 }),
                y: fc.integer({ min: 10, max: 190 }),
              }),
              { minLength: 2, maxLength: 15 }
            ).filter(seq => {
              return seq.some((point, i) => 
                i > 0 && (point.x !== seq[0].x || point.y !== seq[0].y)
              );
            }),
            { minLength: 1, maxLength: 10 } // Multiple strokes
          ),
          async (multipleStrokes) => {
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
            mockCanvasBoundingRect(canvas, 500, 200);

            // Draw multiple strokes to create complex content
            for (const stroke of multipleStrokes) {
              await simulateDrawing(canvas, stroke, 'mouse');
            }

            // Verify onChange was called (indicating drawing occurred)
            await waitFor(() => {
              expect(onChange).toHaveBeenCalled();
            });

            const dataUrlBeforeClear = onChange.mock.calls[onChange.mock.calls.length - 1][0];
            expect(dataUrlBeforeClear).toBeTruthy();

            // Clear all content at once
            ref.current?.clear();

            // Verify all content is erased regardless of complexity
            expect(ref.current?.isEmpty()).toBe(true);
            
            const dataUrlAfterClear = ref.current?.toDataURL();
            const freshCanvas = document.createElement('canvas');
            freshCanvas.width = 500;
            freshCanvas.height = 200;
            const freshDataUrl = freshCanvas.toDataURL('image/png');
            
            expect(dataUrlAfterClear).toBe(freshDataUrl);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle clear on already empty canvas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No drawing, just testing clear on empty canvas
          async () => {
            // Setup
            const onChange = vi.fn();
            const onClear = vi.fn();
            const ref = React.createRef<SignatureCanvasRef>();
            
            const { container } = render(
              <SignatureCanvas
                ref={ref}
                onChange={onChange}
                onClear={onClear}
                width={500}
                height={200}
              />
            );

            const canvas = container.querySelector('canvas') as HTMLCanvasElement;
            expect(canvas).toBeTruthy();

            // Verify canvas starts empty
            expect(ref.current?.isEmpty()).toBe(true);

            // Clear already empty canvas
            ref.current?.clear();

            // Verify canvas remains empty and callbacks are still invoked
            expect(ref.current?.isEmpty()).toBe(true);
            expect(onChange).toHaveBeenCalledWith(null);
            expect(onClear).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Feature: signature-ui-frontend, Property 9: Canvas to base64 conversion format
  describe('Property 9: Canvas to base64 conversion format', () => {
    it('should produce valid PNG data URI for any non-empty canvas content', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary non-empty canvas content with realistic, distinct movements
          fc.array(
            fc.record({
              x: fc.integer({ min: 50, max: 450 }),
              y: fc.integer({ min: 50, max: 150 }),
            }),
            { minLength: 5, maxLength: 20 }
          ).filter(seq => {
            // Ensure points are distinct and have meaningful movement
            const uniquePoints = new Set(seq.map(p => `${p.x},${p.y}`));
            if (uniquePoints.size < 3) return false; // Need at least 3 distinct points
            
            // Check for meaningful total distance
            let totalDistance = 0;
            for (let i = 1; i < seq.length; i++) {
              const dx = seq[i].x - seq[i-1].x;
              const dy = seq[i].y - seq[i-1].y;
              totalDistance += Math.sqrt(dx*dx + dy*dy);
            }
            return totalDistance > 50; // Ensure realistic signature stroke
          }),
          async (pointerSequence) => {
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

            // Mock getBoundingClientRect
            mockCanvasBoundingRect(canvas, 500, 200);

            // Draw arbitrary content on canvas
            await simulateDrawing(canvas, pointerSequence, 'mouse');

            // Wait for onChange to be called
            await waitFor(() => {
              expect(onChange).toHaveBeenCalled();
            }, { timeout: 2000 });

            // Get the data URL from toDataURL()
            const dataUrl = ref.current?.toDataURL();

            // Verify toDataURL() produces string starting with "data:image/png;base64,"
            expect(dataUrl).toBeTruthy();
            expect(dataUrl).toMatch(/^data:image\/png;base64,/);

            // Verify base64 data is valid
            const base64Data = dataUrl!.split(',')[1];
            expect(base64Data).toBeTruthy();
            expect(base64Data.length).toBeGreaterThan(0);

            // Verify base64 string contains only valid base64 characters
            // Valid base64 characters: A-Z, a-z, 0-9, +, /, and = for padding
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            expect(base64Data).toMatch(base64Regex);

            // Verify the base64 data can be decoded (is valid base64)
            expect(() => {
              atob(base64Data);
            }).not.toThrow();

            // Verify the decoded data is non-trivial (not just an empty canvas)
            const decodedLength = atob(base64Data).length;
            expect(decodedLength).toBeGreaterThan(100); // PNG header + some content
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should produce consistent format for different canvas sizes', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary canvas dimensions and drawing content
          fc.record({
            width: fc.integer({ min: 300, max: 700 }),
            height: fc.integer({ min: 150, max: 350 }),
            points: fc.array(
              fc.record({
                xRatio: fc.double({ min: 0.2, max: 0.8 }),
                yRatio: fc.double({ min: 0.2, max: 0.8 }),
              }),
              { minLength: 5, maxLength: 15 }
            ).filter(seq => {
              // Ensure distinct points and meaningful movement
              const uniquePoints = new Set(seq.map(p => `${p.xRatio.toFixed(2)},${p.yRatio.toFixed(2)}`));
              if (uniquePoints.size < 3) return false;
              
              let totalDistance = 0;
              for (let i = 1; i < seq.length; i++) {
                const dx = seq[i].xRatio - seq[i-1].xRatio;
                const dy = seq[i].yRatio - seq[i-1].yRatio;
                totalDistance += Math.sqrt(dx*dx + dy*dy);
              }
              return totalDistance > 0.3; // Ensure realistic movement
            }),
          }),
          async ({ width, height, points }) => {
            // Setup
            const onChange = vi.fn();
            const ref = React.createRef<SignatureCanvasRef>();
            
            const { container } = render(
              <SignatureCanvas
                ref={ref}
                onChange={onChange}
                width={width}
                height={height}
              />
            );

            const canvas = container.querySelector('canvas') as HTMLCanvasElement;
            mockCanvasBoundingRect(canvas, width, height);

            // Convert ratio-based points to absolute coordinates
            const absolutePoints = points.map(p => ({
              x: Math.floor(p.xRatio * width),
              y: Math.floor(p.yRatio * height),
            }));

            // Draw content
            await simulateDrawing(canvas, absolutePoints, 'mouse');

            await waitFor(() => {
              expect(onChange).toHaveBeenCalled();
            }, { timeout: 2000 });

            // Get data URL
            const dataUrl = ref.current?.toDataURL();

            // Verify format is consistent regardless of canvas size
            expect(dataUrl).toBeTruthy();
            expect(dataUrl).toMatch(/^data:image\/png;base64,/);

            const base64Data = dataUrl!.split(',')[1];
            expect(base64Data).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
            
            // Verify valid base64
            expect(() => {
              atob(base64Data);
            }).not.toThrow();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should produce valid base64 for touch-based drawing', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary touch-based drawing with realistic, distinct movements
          fc.array(
            fc.record({
              x: fc.integer({ min: 30, max: 270 }),
              y: fc.integer({ min: 30, max: 120 }),
            }),
            { minLength: 5, maxLength: 15 }
          ).filter(seq => {
            // Ensure distinct points and meaningful movement
            const uniquePoints = new Set(seq.map(p => `${p.x},${p.y}`));
            if (uniquePoints.size < 3) return false;
            
            let totalDistance = 0;
            for (let i = 1; i < seq.length; i++) {
              const dx = seq[i].x - seq[i-1].x;
              const dy = seq[i].y - seq[i-1].y;
              totalDistance += Math.sqrt(dx*dx + dy*dy);
            }
            return totalDistance > 40; // Ensure realistic touch stroke
          }),
          async (touchSequence) => {
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
            mockCanvasBoundingRect(canvas, 300, 150);

            // Draw with touch events
            await simulateDrawing(canvas, touchSequence, 'touch');

            await waitFor(() => {
              expect(onChange).toHaveBeenCalled();
            }, { timeout: 2000 });

            // Verify toDataURL() produces valid format for touch input
            const dataUrl = ref.current?.toDataURL();
            
            expect(dataUrl).toBeTruthy();
            expect(dataUrl).toMatch(/^data:image\/png;base64,/);

            const base64Data = dataUrl!.split(',')[1];
            expect(base64Data).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
            
            // Verify valid base64
            expect(() => {
              atob(base64Data);
            }).not.toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should produce valid base64 for complex multi-stroke drawings', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple strokes to create complex content
          fc.array(
            fc.array(
              fc.record({
                x: fc.integer({ min: 20, max: 480 }),
                y: fc.integer({ min: 20, max: 180 }),
              }),
              { minLength: 3, maxLength: 10 }
            ).filter(seq => {
              // Ensure realistic movement in each stroke
              return seq.some((point, i) => 
                i > 0 && (Math.abs(point.x - seq[0].x) > 10 || Math.abs(point.y - seq[0].y) > 10)
              );
            }),
            { minLength: 2, maxLength: 5 } // Multiple strokes
          ),
          async (multipleStrokes) => {
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
            mockCanvasBoundingRect(canvas, 500, 200);

            // Draw multiple strokes
            for (const stroke of multipleStrokes) {
              await simulateDrawing(canvas, stroke, 'mouse');
            }

            await waitFor(() => {
              expect(onChange).toHaveBeenCalled();
            }, { timeout: 1000 });

            // Verify toDataURL() produces valid format for complex drawings
            const dataUrl = ref.current?.toDataURL();
            
            expect(dataUrl).toBeTruthy();
            expect(dataUrl).toMatch(/^data:image\/png;base64,/);

            const base64Data = dataUrl!.split(',')[1];
            expect(base64Data).toBeTruthy();
            expect(base64Data).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
            
            // Verify valid base64
            expect(() => {
              atob(base64Data);
            }).not.toThrow();

            // Verify the base64 data is non-trivial
            expect(base64Data.length).toBeGreaterThan(10);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain format consistency across multiple conversions', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary drawing content with realistic, distinct movements
          fc.array(
            fc.record({
              x: fc.integer({ min: 50, max: 450 }),
              y: fc.integer({ min: 50, max: 150 }),
            }),
            { minLength: 5, maxLength: 15 }
          ).filter(seq => {
            // Ensure distinct points and meaningful movement
            const uniquePoints = new Set(seq.map(p => `${p.x},${p.y}`));
            if (uniquePoints.size < 3) return false;
            
            let totalDistance = 0;
            for (let i = 1; i < seq.length; i++) {
              const dx = seq[i].x - seq[i-1].x;
              const dy = seq[i].y - seq[i-1].y;
              totalDistance += Math.sqrt(dx*dx + dy*dy);
            }
            return totalDistance > 50; // Ensure realistic stroke
          }),
          async (pointerSequence) => {
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
            mockCanvasBoundingRect(canvas, 500, 200);

            // Draw content
            await simulateDrawing(canvas, pointerSequence, 'mouse');

            await waitFor(() => {
              expect(onChange).toHaveBeenCalled();
            }, { timeout: 2000 });

            // Call toDataURL() multiple times
            const dataUrl1 = ref.current?.toDataURL();
            const dataUrl2 = ref.current?.toDataURL();
            const dataUrl3 = ref.current?.toDataURL();

            // Verify all conversions produce the same result
            expect(dataUrl1).toBe(dataUrl2);
            expect(dataUrl2).toBe(dataUrl3);

            // Verify format is consistent
            expect(dataUrl1).toMatch(/^data:image\/png;base64,/);
            expect(dataUrl2).toMatch(/^data:image\/png;base64,/);
            expect(dataUrl3).toMatch(/^data:image\/png;base64,/);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
