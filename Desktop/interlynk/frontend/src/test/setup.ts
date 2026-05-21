/**
 * Vitest setup file. Polyfills + shims that should be available to every test.
 * Pulled out of vitest.config so we don't recreate the module on each test
 * file isolation pass.
 */

import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia; many of our components query it for
// theme detection. Provide a no-op stub so renders don't throw.
if (typeof window !== 'undefined' && !window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
