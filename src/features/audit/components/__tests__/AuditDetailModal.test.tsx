import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';

// Prevent client.ts from failing when it imports @/router / authStore at load time.
vi.mock('@/router', () => ({
  router: { navigate: vi.fn(), update: vi.fn() },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => vi.fn()),
    {
      getState: () => ({ accessToken: null, clearAuth: vi.fn(), updateAccessToken: vi.fn() }),
    },
  ),
}));

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}));

import { AuditDetailModal } from '../AuditDetailModal';
import type { AuditLog } from '../audit-table.utils';

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'log-1',
    service: 'workflow-service',
    actorId: 'user-1',
    orgId: 'org-1',
    action: 'WORKFLOW_CREATED',
    resourceType: 'workflow',
    resourceId: 'wf-1',
    resourceName: 'My workflow',
    correlationId: 'corr-abc-123',
    ip: null,
    metadata: null,
    timestamp: '2024-01-01T00:00:00Z',
    indexedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as AuditLog;
}

function renderModal(overrides: Partial<AuditLog> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const onFilterByCorrelation = vi.fn();
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <AuditDetailModal
        log={makeLog(overrides)}
        users={[]}
        open={true}
        onClose={onClose}
        onFilterByCorrelation={onFilterByCorrelation}
      />
    </QueryClientProvider>,
  );
  return { onClose, onFilterByCorrelation, container };
}

describe('AuditDetailModal — correlation ID copy/filter actions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('writes the correlation ID to the clipboard and shows a temporary confirmation icon', async () => {
    renderModal();

    // The dialog renders through a portal, so query relative to the button
    // itself rather than the render()'d container.
    const copyButton = screen.getByRole('button', { name: 'Copy correlation ID' });
    await act(async () => {
      fireEvent.click(copyButton);
      // Flush the clipboard promise's microtask so the .then() state update runs.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('corr-abc-123');
    // Icon swaps to a checkmark as visible confirmation the copy happened.
    expect(copyButton.querySelector('.lucide-check')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(copyButton.querySelector('.lucide-check')).toBeNull();
  });

  it('applies the correlation filter, closes the dialog, and confirms via toast', () => {
    const { onClose, onFilterByCorrelation } = renderModal();

    const filterButton = screen.getByRole('button', { name: 'Filter by this correlation ID' });
    fireEvent.click(filterButton);

    expect(onFilterByCorrelation).toHaveBeenCalledWith('corr-abc-123');
    expect(onClose).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('Correlation ID filter applied');
  });
});
