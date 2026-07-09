import { useCallback, useRef } from 'react';

const DRAG_THRESHOLD_PX = 5;

/**
 * Enables click-and-drag horizontal scrolling on a container whose native
 * scrollbar is hidden (e.g. a tab strip that overflows on small screens).
 * Without this, a plain mouse (no trackpad or horizontal wheel) has no way
 * to reach content past the visible edge once the scrollbar is hidden.
 *
 * Uses Pointer Events with setPointerCapture so an in-progress drag keeps
 * tracking the pointer even if it leaves the container's bounds (e.g. a fast
 * horizontal drag with a slight vertical wobble on a narrow tab strip) —
 * plain mouse events would stop on mouseleave and cut the scroll short.
 *
 * Capture is deliberately acquired lazily, only once real drag movement is
 * detected in onPointerMove — NOT eagerly on pointerdown. Capturing the
 * pointer immediately redirects the browser's click-target resolution to the
 * capturing element, which would silently swallow the click on any clickable
 * child (e.g. a TabsTrigger button) for a plain, non-dragging click.
 *
 * Spread the returned `bind` object onto the scrollable element.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const drag = useRef({
    active: false,
    moved: false,
    captured: false,
    startX: 0,
    startScrollLeft: 0,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    drag.current = {
      active: true,
      moved: false,
      captured: false,
      startX: e.pageX,
      startScrollLeft: el.scrollLeft,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const delta = e.pageX - drag.current.startX;
    if (!drag.current.moved && Math.abs(delta) > DRAG_THRESHOLD_PX) {
      drag.current.moved = true;
      el.setPointerCapture?.(e.pointerId);
      drag.current.captured = true;
    }
    el.scrollLeft = drag.current.startScrollLeft - delta;
  }, []);

  const endDrag = useCallback((e?: React.PointerEvent) => {
    if (e && drag.current.captured) ref.current?.releasePointerCapture?.(e.pointerId);
    drag.current.active = false;
    drag.current.captured = false;
  }, []);

  // Suppresses the click that would otherwise fire on whatever element ends
  // up under the cursor after a drag — without this, dragging across tabs
  // could accidentally switch to the wrong one on release.
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }, []);

  return {
    ref,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  };
}
