import { useCallback, useRef } from 'react';

const DRAG_THRESHOLD_PX = 5;

/**
 * Enables click-and-drag horizontal scrolling on a container whose native
 * scrollbar is hidden (e.g. a tab strip that overflows on small screens).
 * Without this, a plain mouse (no trackpad or horizontal wheel) has no way
 * to reach content past the visible edge once the scrollbar is hidden.
 *
 * Uses Pointer Events with setPointerCapture so the drag keeps tracking the
 * pointer even if it leaves the container's bounds (e.g. a fast horizontal
 * drag with a slight vertical wobble on a narrow tab strip) — plain mouse
 * events would stop on mouseleave and cut the scroll short.
 *
 * Spread the returned `bind` object onto the scrollable element.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startScrollLeft: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    // Prevents the browser from starting a native text selection while dragging
    // over the tab labels.
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    drag.current = { active: true, moved: false, startX: e.pageX, startScrollLeft: el.scrollLeft };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const delta = e.pageX - drag.current.startX;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX) drag.current.moved = true;
    el.scrollLeft = drag.current.startScrollLeft - delta;
  }, []);

  const endDrag = useCallback((e?: React.PointerEvent) => {
    if (e) ref.current?.releasePointerCapture?.(e.pointerId);
    drag.current.active = false;
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
