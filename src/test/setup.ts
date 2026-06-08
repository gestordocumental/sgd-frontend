import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// jsdom does not implement Element.prototype.scrollTo — stub it globally so
// components that call parentRef.current?.scrollTo(...) don't throw in tests.
// Use Object.defineProperty instead of direct assignment because jsdom may
// define scrollTo as non-writable, causing silent no-ops on plain assignment.
Object.defineProperty(Element.prototype, 'scrollTo', {
  writable: true,
  configurable: true,
  value: vi.fn(),
});

// Reset localStorage between tests
beforeEach(() => {
  localStorage.clear();
});
