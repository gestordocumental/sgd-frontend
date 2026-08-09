import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import { CompanyDialogs } from '../CompanyDialogs';
import { useAdminCompanies } from '@/features/companies/hooks/use-admin-companies';
import type { ApiCompany } from '@/lib/api/companies';

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('@/lib/api/companies', () => ({
  companiesApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    restore: vi.fn(),
  },
}));

function makeCompany(overrides: Partial<ApiCompany> = {}): ApiCompany {
  return {
    id: 'org-1',
    name: 'Acme',
    nit: '900123456',
    address: 'Main St',
    phone: '5551234',
    status: 'active',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

// Thin harness that exposes the real useAdminCompanies hook to CompanyDialogs,
// with buttons standing in for the row-menu actions (openCreate/openEdit/
// setDeleteCompany) that live in CompaniesTable, out of scope for this test.
function Harness({ editTarget }: { editTarget?: ApiCompany }) {
  const hook = useAdminCompanies();
  return (
    <>
      <button onClick={hook.openCreate}>open-create</button>
      <button onClick={() => editTarget && hook.openEdit(editTarget)}>open-edit</button>
      <button onClick={() => editTarget && hook.setDeleteCompany(editTarget)}>open-delete</button>
      <CompanyDialogs hook={hook} />
    </>
  );
}

function renderHarness(props: { editTarget?: ApiCompany } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ data: [], nextCursor: null, hasMore: false });
});

describe('CompanyDialogs — create', () => {
  it('closes the create dialog on successful submit', async () => {
    mockCreate.mockResolvedValue(makeCompany());
    renderHarness();
    fireEvent.click(screen.getByText('open-create'));
    const submitButton = screen.getByRole('button', { name: 'Create company' });
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'New Co' } });
    await waitFor(() => expect(submitButton).not.toBeDisabled());

    fireEvent.click(submitButton);

    await waitFor(() => expect(screen.queryByText('New company')).not.toBeInTheDocument());
  });

  it('the submit button stays disabled until the required name field is filled', () => {
    renderHarness();
    fireEvent.click(screen.getByText('open-create'));

    expect(screen.getByRole('button', { name: 'Create company' })).toBeDisabled();
  });

  it('cancel closes the dialog without creating anything', () => {
    renderHarness();
    fireEvent.click(screen.getByText('open-create'));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('New company')).not.toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('CompanyDialogs — edit', () => {
  it('cancel closes the edit dialog without updating anything', () => {
    renderHarness({ editTarget: makeCompany() });
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Edit company')).not.toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('pressing Escape dismisses the edit dialog via onOpenChange', () => {
    renderHarness({ editTarget: makeCompany() });
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(screen.queryByText('Edit company')).not.toBeInTheDocument();
  });
});

describe('CompanyDialogs — delete', () => {
  it('shows the company name in the confirmation and deletes it on confirm', async () => {
    mockRemove.mockResolvedValue(undefined);
    const company = makeCompany({ name: 'Doomed Co' });
    renderHarness({ editTarget: company });
    fireEvent.click(screen.getByText('open-delete'));

    expect(screen.getByText('Doomed Co')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(company.id));
  });

  it('cancel closes the delete dialog without deleting anything', () => {
    renderHarness({ editTarget: makeCompany() });
    fireEvent.click(screen.getByText('open-delete'));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete company')).not.toBeInTheDocument();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('pressing Escape dismisses the delete dialog via onOpenChange', () => {
    renderHarness({ editTarget: makeCompany() });
    fireEvent.click(screen.getByText('open-delete'));

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(screen.queryByText('Delete company')).not.toBeInTheDocument();
  });
});
