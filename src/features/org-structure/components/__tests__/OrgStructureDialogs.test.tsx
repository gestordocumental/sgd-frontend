import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n';

// ── Module mocks — declared before any import that triggers them ───────────────

// Prevent client.ts from failing when it imports @/router at load time
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const {
  DEPT,
  AREA,
  CARGO,
  DEPT_CARGO,
  mockUpdateDepartamento,
  mockCreateDepartamento,
  mockUpdateArea,
  mockCreateArea,
  mockUpdateCargo,
  mockCreateCargo,
  mockUpdateDeptCargo,
  mockCreateDeptCargo,
} = vi.hoisted(() => ({
  DEPT: {
    id: 'dept-1',
    orgId: 'org-1',
    name: 'Ventas',
    description: 'Departamento de ventas',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  AREA: {
    id: 'area-1',
    orgId: 'org-1',
    departamentoId: 'dept-1',
    name: 'Preventas',
    description: 'Area de preventas',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  CARGO: {
    id: 'cargo-1',
    orgId: 'org-1',
    departamentoId: 'dept-1',
    areaId: 'area-1',
    name: 'Ejecutivo de ventas',
    description: 'Cargo ejecutivo de ventas',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  DEPT_CARGO: {
    id: 'cargo-2',
    orgId: 'org-1',
    departamentoId: 'dept-1',
    areaId: null,
    name: 'Gerente de departamento',
    description: 'Cargo gerencial de departamento',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  mockUpdateDepartamento: vi.fn(),
  mockCreateDepartamento: vi.fn(),
  mockUpdateArea: vi.fn(),
  mockCreateArea: vi.fn(),
  mockUpdateCargo: vi.fn(),
  mockCreateCargo: vi.fn(),
  mockUpdateDeptCargo: vi.fn(),
  mockCreateDeptCargo: vi.fn(),
}));

// ── API mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/org-structure', () => ({
  orgStructureApi: {
    listDepartamentos: vi.fn().mockResolvedValue([DEPT]),
    listAreas: vi.fn().mockResolvedValue([AREA]),
    listCargos: vi.fn().mockResolvedValue([CARGO]),
    listDeptCargos: vi.fn().mockResolvedValue([DEPT_CARGO]),
    createDepartamento: (...args: unknown[]) => mockCreateDepartamento(...args),
    updateDepartamento: (...args: unknown[]) => mockUpdateDepartamento(...args),
    deleteDepartamento: vi.fn(),
    createArea: (...args: unknown[]) => mockCreateArea(...args),
    updateArea: (...args: unknown[]) => mockUpdateArea(...args),
    deleteArea: vi.fn(),
    createCargo: (...args: unknown[]) => mockCreateCargo(...args),
    updateCargo: (...args: unknown[]) => mockUpdateCargo(...args),
    deleteCargo: vi.fn(),
    createDeptCargo: (...args: unknown[]) => mockCreateDeptCargo(...args),
    updateDeptCargo: (...args: unknown[]) => mockUpdateDeptCargo(...args),
    deleteDeptCargo: vi.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure';
import { DepartamentosTabContent } from '@/features/org-structure/components/tabs/DepartamentosTabContent';
import { AreasTabContent } from '@/features/org-structure/components/tabs/AreasTabContent';
import { CargosTabContent } from '@/features/org-structure/components/tabs/CargosTabContent';
import { OrgStructureDialogs } from '@/features/org-structure/components/OrgStructureDialogs';
import { Tabs } from '@/components/ui/tabs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function Harness() {
  const hook = useOrgStructure('org-1');
  return (
    <Tabs defaultValue="departamentos">
      <DepartamentosTabContent hook={hook} canWrite />
      <OrgStructureDialogs hook={hook} />
    </Tabs>
  );
}

function AreaHarness() {
  const hook = useOrgStructure('org-1');
  return (
    <Tabs defaultValue="areas">
      <AreasTabContent hook={hook} canWrite />
      <OrgStructureDialogs hook={hook} />
    </Tabs>
  );
}

function CargoHarness() {
  const hook = useOrgStructure('org-1');
  return (
    <Tabs defaultValue="cargos">
      <CargosTabContent hook={hook} canWrite />
      <OrgStructureDialogs hook={hook} />
    </Tabs>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Create department dialog after editing an existing department', () => {
  it('opens with empty fields instead of the previously edited department data', async () => {
    mockUpdateDepartamento.mockResolvedValue(DEPT);

    const user = userEvent.setup();
    render(<Harness />, { wrapper: makeWrapper() });

    // Department list loads
    await screen.findByText('Ventas');

    // Open the edit dialog for the existing department — this populates
    // deptForm's internal default values with the department's data.
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Edit department');
    expect(screen.getByPlaceholderText('Name')).toHaveValue('Ventas');
    expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue(
      'Departamento de ventas',
    );

    // Close without saving, as a user would after just inspecting the record
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('Edit department')).not.toBeInTheDocument();
    });

    // Now open the create dialog — same form instance is reused
    await user.click(screen.getByRole('button', { name: 'New department' }));
    await screen.findByRole('heading', { name: 'New department' });

    // Regression check: fields must be empty, not pre-filled with the
    // previously edited department's name/description.
    expect(screen.getByPlaceholderText('Name')).toHaveValue('');
    expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue('');
  });
});

describe('Create area dialog after editing an existing area', () => {
  it('opens with empty fields instead of the previously edited area data', async () => {
    mockUpdateArea.mockResolvedValue(AREA);

    const user = userEvent.setup();
    render(<AreaHarness />, { wrapper: makeWrapper() });

    // Select the department so its areas load
    await screen.findByRole('option', { name: 'Ventas' });
    await user.selectOptions(screen.getByLabelText('Department:'), 'dept-1');

    // Area list loads
    await screen.findByText('Preventas');

    // Open the edit dialog for the existing area — this populates
    // areaForm's internal default values with the area's data.
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Edit area');
    expect(screen.getByPlaceholderText('Name')).toHaveValue('Preventas');
    expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue('Area de preventas');

    // Close without saving
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('Edit area')).not.toBeInTheDocument();
    });

    // Now open the create dialog — same form instance is reused
    await user.click(screen.getByRole('button', { name: 'New area' }));
    await screen.findByRole('heading', { name: 'New area' });

    // Regression check: fields must be empty, not pre-filled with the
    // previously edited area's name/description.
    expect(screen.getByPlaceholderText('Name')).toHaveValue('');
    expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue('');
  });
});

describe('Create position dialog after editing an existing area-level position', () => {
  it('opens with empty fields instead of the previously edited position data', async () => {
    mockUpdateCargo.mockResolvedValue(CARGO);

    const user = userEvent.setup();
    render(<CargoHarness />, { wrapper: makeWrapper() });

    // Select department and area so area-scoped positions load
    await screen.findByRole('option', { name: 'Ventas' });
    await user.selectOptions(screen.getByLabelText('Department:'), 'dept-1');
    await screen.findByRole('option', { name: 'Preventas' });
    await user.selectOptions(screen.getByLabelText('Area:'), 'area-1');

    // Position list loads
    await screen.findByText('Ejecutivo de ventas');

    // Open the edit dialog for the existing position — this populates
    // cargoForm's internal default values with the position's data.
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Edit position');
    expect(screen.getByPlaceholderText('Name')).toHaveValue('Ejecutivo de ventas');
    expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue(
      'Cargo ejecutivo de ventas',
    );

    // Close without saving
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('Edit position')).not.toBeInTheDocument();
    });

    // Now open the create dialog — same form instance is reused
    await user.click(screen.getByRole('button', { name: 'New position' }));
    await screen.findByRole('heading', { name: 'New position' });

    // Regression check: fields must be empty, not pre-filled with the
    // previously edited position's name/description.
    expect(screen.getByPlaceholderText('Name')).toHaveValue('');
    expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue('');
  });
});

describe('Create position dialog after editing an existing department-level position', () => {
  it('opens with empty fields instead of the previously edited position data', async () => {
    mockUpdateDeptCargo.mockResolvedValue(DEPT_CARGO);

    const user = userEvent.setup();
    render(<CargoHarness />, { wrapper: makeWrapper() });

    // Select the department only — leave area at "— Department level —"
    await screen.findByRole('option', { name: 'Ventas' });
    await user.selectOptions(screen.getByLabelText('Department:'), 'dept-1');

    // Department-level position list loads
    await screen.findByText('Gerente de departamento');

    // Open the edit dialog for the existing position — this populates
    // deptCargoForm's internal default values with the position's data.
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Edit position');
    expect(screen.getByPlaceholderText('Name')).toHaveValue('Gerente de departamento');
    expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue(
      'Cargo gerencial de departamento',
    );

    // Close without saving
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('Edit position')).not.toBeInTheDocument();
    });

    // Now open the create dialog — same form instance is reused
    await user.click(screen.getByRole('button', { name: 'New position' }));
    await screen.findByRole('heading', { name: 'New position' });

    // Regression check: fields must be empty, not pre-filled with the
    // previously edited position's name/description.
    expect(screen.getByPlaceholderText('Name')).toHaveValue('');
    expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue('');
  });
});
