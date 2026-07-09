import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDragScroll } from '../use-drag-scroll';

function makePointerEvent(overrides: Partial<React.PointerEvent> = {}): React.PointerEvent {
  return {
    button: 0,
    pageX: 0,
    pointerId: 1,
    preventDefault: () => {},
    stopPropagation: () => {},
    ...overrides,
  } as React.PointerEvent;
}

// jsdom doesn't implement the Pointer Capture API — stub it so the hook's
// optional-chained calls have something to record without throwing.
function makeElement() {
  const el = document.createElement('div');
  (el as unknown as Record<string, unknown>).setPointerCapture = vi.fn();
  (el as unknown as Record<string, unknown>).releasePointerCapture = vi.fn();
  return el as HTMLDivElement & {
    setPointerCapture: ReturnType<typeof vi.fn>;
    releasePointerCapture: ReturnType<typeof vi.fn>;
  };
}

describe('useDragScroll', () => {
  it('scrolls the element by the drag distance', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    Object.defineProperty(el, 'scrollWidth', { value: 500, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: 200, configurable: true });
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onPointerDown(makePointerEvent({ pageX: 100 }));
    result.current.bind.onPointerMove(makePointerEvent({ pageX: 70 })); // dragged 30px left

    expect(el.scrollLeft).toBe(80); // startScrollLeft(50) - delta(-30)
  });

  it('prevents the default action on pointerdown to avoid native text selection while dragging', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    result.current.ref.current = el;

    let prevented = false;
    result.current.bind.onPointerDown(
      makePointerEvent({
        pageX: 100,
        preventDefault: () => {
          prevented = true;
        },
      }),
    );

    expect(prevented).toBe(true);
  });

  it('captures the pointer on pointerdown so drag keeps tracking outside the element bounds', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    result.current.ref.current = el;

    result.current.bind.onPointerDown(makePointerEvent({ pageX: 100, pointerId: 7 }));

    expect(el.setPointerCapture).toHaveBeenCalledWith(7);
  });

  it('releases the pointer capture on pointerup', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    result.current.ref.current = el;

    result.current.bind.onPointerDown(makePointerEvent({ pageX: 100, pointerId: 7 }));
    result.current.bind.onPointerUp(makePointerEvent({ pointerId: 7 }));

    expect(el.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('does not scroll on pointermove before a pointerdown', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onPointerMove(makePointerEvent({ pageX: 999 }));

    expect(el.scrollLeft).toBe(50);
  });

  it('ignores non-primary buttons (e.g. right-click)', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onPointerDown(makePointerEvent({ button: 2, pageX: 100 }));
    result.current.bind.onPointerMove(makePointerEvent({ pageX: 0 }));

    expect(el.scrollLeft).toBe(50);
  });

  it('stops scrolling after pointerup', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onPointerDown(makePointerEvent({ pageX: 100 }));
    result.current.bind.onPointerUp(makePointerEvent());
    result.current.bind.onPointerMove(makePointerEvent({ pageX: 0 }));

    expect(el.scrollLeft).toBe(50);
  });

  it('stops scrolling after pointercancel — keeps tracking past the element bounds until then', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onPointerDown(makePointerEvent({ pageX: 100 }));
    // Simulates the pointer moving outside the narrow tab strip — with pointer
    // capture this keeps scrolling instead of stopping like a plain mouseleave would.
    result.current.bind.onPointerMove(makePointerEvent({ pageX: 40 }));
    expect(el.scrollLeft).toBe(110);

    result.current.bind.onPointerCancel(makePointerEvent());
    result.current.bind.onPointerMove(makePointerEvent({ pageX: 0 }));

    expect(el.scrollLeft).toBe(110);
  });

  it('suppresses the click that follows a real drag, so tabs are not switched accidentally', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    result.current.ref.current = el;

    result.current.bind.onPointerDown(makePointerEvent({ pageX: 100 }));
    result.current.bind.onPointerMove(makePointerEvent({ pageX: 50 })); // past the drag threshold

    let prevented = false;
    let stopped = false;
    result.current.bind.onClickCapture(
      makePointerEvent({
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: () => {
          stopped = true;
        },
      }) as unknown as React.MouseEvent,
    );

    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });

  it('does not suppress a plain click (no drag movement)', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = makeElement();
    result.current.ref.current = el;

    result.current.bind.onPointerDown(makePointerEvent({ pageX: 100 }));
    result.current.bind.onPointerUp(makePointerEvent());

    let prevented = false;
    result.current.bind.onClickCapture(
      makePointerEvent({
        preventDefault: () => {
          prevented = true;
        },
      }) as unknown as React.MouseEvent,
    );

    expect(prevented).toBe(false);
  });
});
