import { vi } from 'vitest';

/**
 * jsdom never actually fetches image resources, so `AvatarImage` (which waits
 * for `image.complete`/`onload` before swapping out the fallback) stays in the
 * "loading" state forever and its `<img>` never mounts in tests. Call this in
 * `beforeEach` to make `new Image()` report an immediate successful load, and
 * pair it with `vi.unstubAllGlobals()` in `afterEach`.
 */
export function mockImageLoad() {
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    complete = false;
    naturalWidth = 0;
    set src(value: string) {
      if (value) {
        this.complete = true;
        this.naturalWidth = 1;
      }
    }
  }
  vi.stubGlobal('Image', MockImage);
}
