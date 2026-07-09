import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDragScroll } from '../use-drag-scroll';

function makeMouseEvent(overrides: Partial<React.MouseEvent> = {}): React.MouseEvent {
  return {
    button: 0,
    pageX: 0,
    preventDefault: () => {},
    stopPropagation: () => {},
    ...overrides,
  } as React.MouseEvent;
}

describe('useDragScroll', () => {
  it('scrolls the element by the drag distance', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollWidth', { value: 500, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: 200, configurable: true });
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onMouseDown(makeMouseEvent({ pageX: 100 }));
    result.current.bind.onMouseMove(makeMouseEvent({ pageX: 70 })); // dragged 30px left

    expect(el.scrollLeft).toBe(80); // startScrollLeft(50) - delta(-30)
  });

  it('does not scroll on mousemove before a mousedown', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = document.createElement('div');
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onMouseMove(makeMouseEvent({ pageX: 999 }));

    expect(el.scrollLeft).toBe(50);
  });

  it('ignores non-primary mouse buttons (e.g. right-click)', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = document.createElement('div');
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onMouseDown(makeMouseEvent({ button: 2, pageX: 100 }));
    result.current.bind.onMouseMove(makeMouseEvent({ pageX: 0 }));

    expect(el.scrollLeft).toBe(50);
  });

  it('stops scrolling after mouseup', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = document.createElement('div');
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onMouseDown(makeMouseEvent({ pageX: 100 }));
    result.current.bind.onMouseUp();
    result.current.bind.onMouseMove(makeMouseEvent({ pageX: 0 }));

    expect(el.scrollLeft).toBe(50);
  });

  it('stops scrolling after mouseleave', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = document.createElement('div');
    el.scrollLeft = 50;
    result.current.ref.current = el;

    result.current.bind.onMouseDown(makeMouseEvent({ pageX: 100 }));
    result.current.bind.onMouseLeave();
    result.current.bind.onMouseMove(makeMouseEvent({ pageX: 0 }));

    expect(el.scrollLeft).toBe(50);
  });

  it('suppresses the click that follows a real drag, so tabs are not switched accidentally', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = document.createElement('div');
    result.current.ref.current = el;

    result.current.bind.onMouseDown(makeMouseEvent({ pageX: 100 }));
    result.current.bind.onMouseMove(makeMouseEvent({ pageX: 50 })); // past the drag threshold

    let prevented = false;
    let stopped = false;
    result.current.bind.onClickCapture(
      makeMouseEvent({
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: () => {
          stopped = true;
        },
      }),
    );

    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });

  it('does not suppress a plain click (no drag movement)', () => {
    const { result } = renderHook(() => useDragScroll<HTMLDivElement>());
    const el = document.createElement('div');
    result.current.ref.current = el;

    result.current.bind.onMouseDown(makeMouseEvent({ pageX: 100 }));
    result.current.bind.onMouseUp();

    let prevented = false;
    result.current.bind.onClickCapture(
      makeMouseEvent({
        preventDefault: () => {
          prevented = true;
        },
      }),
    );

    expect(prevented).toBe(false);
  });
});
