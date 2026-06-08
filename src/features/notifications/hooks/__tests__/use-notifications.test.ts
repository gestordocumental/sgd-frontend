import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../use-notifications';

// ── EventSource mock ──────────────────────────────────────────────────────────

type EventHandler = (e: Event) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  onerror: EventHandler | null = null;
  private listeners = new Map<string, EventHandler[]>();

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: EventHandler) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
  }

  close = vi.fn();

  // Test helpers
  triggerError() {
    this.onerror?.(new Event('error'));
  }

  emit(type: string, data?: string) {
    (this.listeners.get(type) ?? []).forEach((h) => h(new MessageEvent(type, { data })));
  }
}

vi.stubGlobal('EventSource', MockEventSource);

// ── BroadcastChannel mock ─────────────────────────────────────────────────────

const bcPostMessage = vi.fn();
const bcClose = vi.fn();

class MockBroadcastChannel {
  postMessage = bcPostMessage;
  close = bcClose;

  constructor(_channel: string) {}
}

vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

// ── @tanstack/react-query mock ────────────────────────────────────────────────
// We only care about the SSE/reconnection logic; queries and mutations are
// tested separately via their own tests.

const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useQuery: () => ({ data: undefined }),
  useInfiniteQuery: () => ({
    data: undefined,
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  }),
  useMutation: (opts: { mutationFn: unknown }) => ({
    mutate: vi.fn(),
    isPending: false,
    mutationFn: opts.mutationFn,
  }),
}));

// ── Other dependencies ────────────────────────────────────────────────────────

const mockSseTicket = vi.fn();

vi.mock('@/lib/api/notifications', () => ({
  notificationsApi: {
    sseTicket: (...args: unknown[]) => mockSseTicket(...args),
    list: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    unreadCount: vi.fn().mockResolvedValue({ count: 0 }),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

let mockAccessToken: string | null = 'test-access-token';
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: { accessToken: string | null }) => unknown) =>
    sel({ accessToken: mockAccessToken }),
}));

vi.mock('@/lib/jwt', () => ({
  decodeJwt: vi.fn().mockReturnValue({ companyId: 'company-1' }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flush all pending microtasks (promise continuations). */
const flushMicrotasks = () =>
  act(async () => {
    await Promise.resolve();
  });

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('useNotifications — SSE lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAccessToken = 'test-access-token';
    MockEventSource.instances = [];
    mockSseTicket.mockResolvedValue({ ticket: 'ticket-abc', expiresIn: 30 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('opens an EventSource with the ticket in the URL on mount', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    expect(mockSseTicket).toHaveBeenCalledOnce();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('ticket=ticket-abc');

    unmount();
  });

  it('does not open a connection when there is no access token', async () => {
    mockAccessToken = null;
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    expect(mockSseTicket).not.toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(0);

    unmount();
  });

  it('closes the EventSource and BroadcastChannel on unmount', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    unmount();

    expect(MockEventSource.instances[0].close).toHaveBeenCalled();
    expect(bcClose).toHaveBeenCalled();
  });

  it('schedules a retry after an SSE error and doubles the delay each time', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    const firstEs = MockEventSource.instances[0];

    // First error — next retry fires after ~1 s (with jitter, between 750 ms and 1500 ms).
    act(() => {
      firstEs.triggerError();
    });
    expect(MockEventSource.instances).toHaveLength(1); // no new ES yet

    // Advance past the maximum jittered first delay (1500 ms) and flush.
    await act(async () => {
      vi.advanceTimersByTime(1_600);
    });
    await flushMicrotasks();

    expect(mockSseTicket).toHaveBeenCalledTimes(2);
    expect(MockEventSource.instances).toHaveLength(2);

    // Second error — next retry fires after ~2 s (backoff doubled).
    const secondEs = MockEventSource.instances[1];
    act(() => {
      secondEs.triggerError();
    });

    // Advance by first delay window — should NOT reconnect yet (delay is now ~2 s).
    await act(async () => {
      vi.advanceTimersByTime(1_600);
    });
    await flushMicrotasks();
    expect(mockSseTicket).toHaveBeenCalledTimes(2); // no new call yet

    // Advance past the second window.
    await act(async () => {
      vi.advanceTimersByTime(1_600);
    });
    await flushMicrotasks();
    expect(mockSseTicket).toHaveBeenCalledTimes(3);

    unmount();
  });

  it('resets backoff delay to 1 s when a notification event is received', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    const es = MockEventSource.instances[0];

    // Simulate two errors so backoff reaches ~4 s.
    act(() => {
      es.triggerError();
    });
    await act(async () => {
      vi.advanceTimersByTime(1_600);
    });
    await flushMicrotasks();
    const es2 = MockEventSource.instances[1];
    act(() => {
      es2.triggerError();
    });
    await act(async () => {
      vi.advanceTimersByTime(3_200);
    });
    await flushMicrotasks();

    // A notification arrives on the third connection — delay resets to 1 s.
    const es3 = MockEventSource.instances[2];
    act(() => {
      es3.emit('notification');
    });

    // Disconnect again; next retry should fire within the 1 s window.
    act(() => {
      es3.triggerError();
    });
    await act(async () => {
      vi.advanceTimersByTime(1_600);
    });
    await flushMicrotasks();

    expect(mockSseTicket).toHaveBeenCalledTimes(4);

    unmount();
  });

  it('does not open multiple simultaneous connections if onerror fires twice', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    const es = MockEventSource.instances[0];

    // Fire onerror twice in rapid succession — only one retry timer should run.
    act(() => {
      es.triggerError();
      es.triggerError(); // second fire must not enqueue a second timer
    });

    await act(async () => {
      vi.advanceTimersByTime(1_600);
    });
    await flushMicrotasks();

    // Only one new connection should have been opened.
    expect(mockSseTicket).toHaveBeenCalledTimes(2);
    expect(MockEventSource.instances).toHaveLength(2);

    unmount();
  });

  it('does not attempt a second connection while a ticket fetch is in flight', async () => {
    // Ticket fetch hangs indefinitely.
    let resolveTicket!: (v: { ticket: string; expiresIn: number }) => void;
    mockSseTicket.mockReturnValueOnce(
      new Promise<{ ticket: string; expiresIn: number }>((r) => {
        resolveTicket = r;
      }),
    );

    const { unmount } = renderHook(() => useNotifications());
    // connect() has started but sseTicket() has not resolved yet.

    // Dispatch the online event — a second connect() attempt should be blocked.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Resolve the first ticket fetch now.
    await act(async () => {
      resolveTicket({ ticket: 'ticket-abc', expiresIn: 30 });
      await Promise.resolve();
    });

    expect(mockSseTicket).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances).toHaveLength(1);

    unmount();
  });

  it('reconnects immediately when the browser comes online, resetting backoff', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    // Trigger an error so a retry timer is scheduled.
    act(() => {
      MockEventSource.instances[0].triggerError();
    });
    expect(mockSseTicket).toHaveBeenCalledTimes(1);

    // Network comes back online before the backoff timer fires.
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    // Should have reconnected immediately without waiting for the timer.
    expect(mockSseTicket).toHaveBeenCalledTimes(2);
    expect(MockEventSource.instances).toHaveLength(2);

    unmount();
  });

  it('reconnects immediately when the tab becomes visible while disconnected', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    // Trigger an error so the connection is gone.
    act(() => {
      MockEventSource.instances[0].triggerError();
    });
    expect(mockSseTicket).toHaveBeenCalledTimes(1);

    // User returns to the tab before the backoff timer fires.
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mockSseTicket).toHaveBeenCalledTimes(2);
    expect(MockEventSource.instances).toHaveLength(2);

    unmount();
  });

  it('invalidates notification queries when a notification event arrives', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    act(() => {
      MockEventSource.instances[0].emit('notification');
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['notifications-list'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['notifications-unread-count'],
    });

    unmount();
  });

  it('posts session-revoked to BroadcastChannel for the current company', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    act(() => {
      MockEventSource.instances[0].emit('session-revoked', JSON.stringify({ orgId: 'company-1' }));
    });

    expect(bcPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sgd:session-revoked', orgId: 'company-1' }),
    );

    unmount();
  });

  it('ignores session-revoked for a different company', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    act(() => {
      MockEventSource.instances[0].emit('session-revoked', JSON.stringify({ orgId: 'other-co' }));
    });

    expect(bcPostMessage).not.toHaveBeenCalled();

    unmount();
  });

  it('does not reconnect after unmount even if a retry timer was pending', async () => {
    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    act(() => {
      MockEventSource.instances[0].triggerError();
    });

    // Unmount before the timer fires.
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    await flushMicrotasks();

    // sseTicket must not be called again after unmount.
    expect(mockSseTicket).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('removes online and visibilitychange listeners on unmount', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const docAddSpy = vi.spyOn(document, 'addEventListener');
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(docAddSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(docRemoveSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('retries a failed ticket fetch with exponential backoff', async () => {
    mockSseTicket.mockRejectedValueOnce(new Error('network error'));

    const { unmount } = renderHook(() => useNotifications());
    await flushMicrotasks();

    expect(mockSseTicket).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances).toHaveLength(0); // no ES opened

    // Advance past the jittered 1 s initial window.
    await act(async () => {
      vi.advanceTimersByTime(1_600);
    });
    await flushMicrotasks();

    expect(mockSseTicket).toHaveBeenCalledTimes(2);
    expect(MockEventSource.instances).toHaveLength(1);

    unmount();
  });
});
