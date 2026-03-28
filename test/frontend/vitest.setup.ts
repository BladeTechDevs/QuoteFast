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

// Return a realistic PNG data URI (20x20 RGBA PNG, ~1494 bytes decoded, > 100 bytes)
const MOCK_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAAAAAAAAAAAFnUlEQVR4AQXBCSCQBwCA0b9RCkkRG6VhEUWlclSUUFquQjlaRCUUIiyhCEUplKIojYooRKkURSi6aJGKYkiHRjR0fXtPEASBseNlUFBRQ32OAXNNLTC2d8Fqkz/OwdFs3pdCYGoukefLOFRaT9r9DnJaBrnyUZxKJvNYehYtyia801nNoIkngpiEPLKTNFHWMkTbyIYF1u6YuwZhvy0Wt8g0fA/nE5pVQezlpxyt7iaz6SsF3VLcHFamVnwuTYrL6JjhRJ/hVn5Y7UaQktNGUd2Yafp2zFvuwRKnEKy941kbmoFnfBFBJ6vZk99Mwq0PpNfD+fYJlPRP5Y6oPvUTV9Cqto73etsYMo9ipOMxhInKZqjoODDTxJuFduEs35jI6qAs3PeW4JdSS1hOC3HXezlWJ0LWSzkKezQo+7GQunHWPPvVjc7ZgXxasg9sTyC54SLCpBlr0TD0RdcqEhOXZGz8svkjohSvpIcEZ7YRVTxAYpUYJxsVyH2jxdWhxVSNsaVBYROvpu/gw8IDDFueYtS6S8j4ViGo6gUwyzwGQ8dUfvfKY83OcjYcaGBbeifhF4fYXy5BymMlzrTN5tInU8pF1nBf1ovmqWF06SbQvywTweEKYz3voRDyEkFzSRx6tumYbihgZWAl62Ia8T72lj+zvxF9bRxJtSqcejGPvA/mXPvuTLWUD0+mRPB61hF6jM/xZdV1xNwfILv9NcrR/QizLU9jtK6YFb41OOx+zsbEHvz/EthVJMOBO2qkPjXgbJcFRYMu3Brtz4NfonmumcKbBbkMWJQx4o96pHw6UNw1yLQEcQR9h6uYedaxKqQVl/19bEkTZccFeWLKNDn8yJCM1zZc6HPn+k9B1MjE8vdvabTNy+fj0gq+rnnK6M3dTNzxFZU4KWaeUEZY5P4Ii+3tOEZ/ZtPR0QScU2T3VW3i7xlz/Lkd5957UPwthNtj43molMGLmUV0L67m88pmfnL7wLgAmBQ1AY3kqeie1UdY6tOF7a5hXBMk2Xp6CiGXdNhbacaRvx043enNxf/CKRVL5O7PWTzVKKF9fi3/rmjh29pexmwVQS5cDtVDGszKWIhhoTWC5Y7vOMVJ43FCle15ukTcXM7Bh2s58cqX7N5ILo9IpmJCNo9US3k59yFvzdr4b/UAIh5iSP+pwORYLTSPL0Yv1xbTG5sQ7KJkWZ+sjs/Z+ewssWTfXVeSmwP4610M+V9TuSGZx73J5TRqN/DPok56bYb4vl4CcX8l5PfM5rcjpsw+swajK16sqAlDcD40nc0ZRgQWriSyYgOHngST1hFHzud0rowqoFK+ksfTGmkxeMu7378x6DwO0S0qjA+bh9JBc6afcka/wAez2xGsajiC4HZ8Cb659oTe2Ezsg50cbT1I5r+nKRCKuTm+hlqV5zTN6aHDVKDPXoYfm9SQCDbg530WTE11Qee8P4tKo7G4n4JjSy6C5xlHgq5sYU/NLhKeJZH+9gznv1ylRKKOO5Naqdfqo9VIlPfW8gy5ajJymyETIm2YctidGVlBGFyOZWl1GrZN+bh2VyD4FfgRdnsPcQ1HOfZPDlkDNygc+YgyuXbq1D/zTH80ncsV+eSkDd7GSIba8Uu8B2onQ5iTH8/iWxlY1hfh1F6NR38zQnDpXqLuHyex5QInP94ilydcle6iSnmYBh1JXplM4YOdDsMbzRgV5IDMXm9+TQlHKyeR+dezWFZXgt3LWtb3tODzoxchvPok+5sKSem+w5nhJi6Jv6Nc8Tv3Z0jTbKhKl5Uu/S7LEfzWMjbCF4WkSNQzk5lbnI1xVSlWjQ9xftPG5qEBAseIIUTXXyap/S6n+l+QJ/qRaxNHUK0myxM9dV6bz6fH0ZIvXq6I7QxA9kAMyumpaF/MY0F5OeaPG7Bv68Tt0xC+IhKEyirxP56u5Y4AAAAAAAAAAElFTkSuQmCC';
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => `data:image/png;base64,${MOCK_PNG_BASE64}`);
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
