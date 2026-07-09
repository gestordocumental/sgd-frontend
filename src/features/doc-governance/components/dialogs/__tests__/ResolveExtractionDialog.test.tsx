import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import '@/i18n';

// ── Module mocks — declared before any import that triggers them ───────────────

vi.mock('@/router', () => ({
  router: { navigate: vi.fn(), update: vi.fn() },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => undefined),
    {
      getState: () => ({ accessToken: null, clearAuth: vi.fn(), updateAccessToken: vi.fn() }),
    },
  ),
}));

const mockResolveExtraction = vi.fn();

vi.mock('@/lib/api/typologies', () => ({
  typologiesApi: {
    stats: vi.fn().mockResolvedValue({}),
    storagePerOrg: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
    uploadDocument: vi.fn().mockResolvedValue({}),
    newVersion: vi.fn().mockResolvedValue({}),
    signedUrl: vi.fn().mockResolvedValue({ signedUrl: '', expiresAt: '' }),
    retryExtraction: vi.fn().mockResolvedValue({ message: '', extractionStatus: '' }),
    history: vi.fn().mockResolvedValue([]),
    previewExtract: vi.fn().mockResolvedValue({ nombre: null, codigo: null, version: null }),
    resolveExtraction: (...args: unknown[]) => mockResolveExtraction(...args),
  },
}));

vi.mock('@/lib/api/org-structure', () => ({
  orgStructureApi: {
    listDepartamentos: vi.fn().mockResolvedValue([]),
    listAreas: vi.fn().mockResolvedValue([]),
    listDeptCargos: vi.fn().mockResolvedValue([]),
    listCargos: vi.fn().mockResolvedValue([]),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { ResolveExtractionDialog } from '../ResolveExtractionDialog';
import { useTypologies } from '@/features/doc-governance/hooks/use-typologies';
import type { ApiTypology } from '@/lib/api/typologies';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function makeTypology(overrides: Partial<ApiTypology> = {}): ApiTypology {
  return {
    id: 'typo-1',
    orgId: 'org-1',
    typologyStatus: 'INCOMPLETE',
    estructuraOrg: {
      departamentoId: 'dept-1',
      departamentoNombre: 'Finance',
      areaId: null,
      areaNombre: null,
      cargoId: null,
      cargoNombre: null,
    },
    datosDeclarados: {
      nombre: 'Security Policy',
      codigo: 'POL-SEC-001',
      version: 'v1.0',
      fuente: 'MANUAL',
    },
    documento: {
      r2Key: 'r2/key',
      originalName: 'policy.pdf',
      mimeType: 'application/pdf',
      uploadedAt: '2026-01-01T00:00:00.000Z',
      extractionStatus: 'DISCREPANCY',
    },
    metadataExtraida: {
      nombre: 'Security Policy v2',
      codigo: 'POL-SEC-002',
      version: 'v2.0',
      extractedAt: '2026-01-01T00:00:00.000Z',
      discrepancias: [],
    },
    fuenteCreacion: 'MANUAL',
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function ResolveDialogHarness({ typo }: { typo: ApiTypology }) {
  const hook = useTypologies('org-1');

  useEffect(() => {
    hook.openResolve(typo);
    // openResolve is stable across renders — safe to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ResolveExtractionDialog hook={hook} />;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ResolveExtractionDialog', () => {
  it('shows the diff table for a DISCREPANCY typology', async () => {
    const typo = makeTypology({
      metadataExtraida: {
        nombre: 'Security Policy v2',
        codigo: 'POL-SEC-001',
        version: 'v1.0',
        extractedAt: '2026-01-01T00:00:00.000Z',
        discrepancias: [
          {
            campo: 'nombre',
            valorDeclarado: 'Security Policy',
            valorExtraido: 'Security Policy v2',
          },
        ],
      },
    });

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });

    await screen.findByText('Review document information');
    expect(screen.getByText('Security Policy')).toBeInTheDocument();
    expect(screen.getByText('Security Policy v2')).toBeInTheDocument();
    // "Keep what I entered" is offered since there IS declared data
    expect(screen.getByText('Keep what I entered')).toBeInTheDocument();
  });

  it('shows the extracted-values summary (no diff table, no keep-declared option) for PENDING_CONFIRMATION', async () => {
    const typo = makeTypology({
      documento: {
        r2Key: 'r2/key',
        originalName: 'policy.pdf',
        mimeType: 'application/pdf',
        uploadedAt: '2026-01-01T00:00:00.000Z',
        extractionStatus: 'PENDING_CONFIRMATION',
      },
      datosDeclarados: { nombre: null, codigo: null, version: null, fuente: 'MANUAL' },
      metadataExtraida: {
        nombre: 'Extracted Name',
        codigo: 'EXT-001',
        version: 'v1.0',
        extractedAt: '2026-01-01T00:00:00.000Z',
        discrepancias: [],
      },
    });

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });

    await screen.findByText('Review document information');
    expect(screen.getByText('Extracted Name')).toBeInTheDocument();
    expect(screen.queryByText('Keep what I entered')).not.toBeInTheDocument();
    // KEEP_DECLARED is hidden for this status, so it can't be the default selection.
    expect(
      screen.getByRole('radio', { name: /Use what was extracted from the document/ }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('defaults to ADOPT_EXTRACTED (not the hidden KEEP_DECLARED) for PENDING_CONFIRMATION', async () => {
    mockResolveExtraction.mockResolvedValue(makeTypology());
    const user = userEvent.setup();
    const typo = makeTypology({
      documento: {
        r2Key: 'r2/key',
        originalName: 'policy.pdf',
        mimeType: 'application/pdf',
        uploadedAt: '2026-01-01T00:00:00.000Z',
        extractionStatus: 'PENDING_CONFIRMATION',
      },
      datosDeclarados: { nombre: null, codigo: null, version: null, fuente: 'MANUAL' },
      metadataExtraida: {
        nombre: 'Extracted Name',
        codigo: 'EXT-001',
        version: 'v1.0',
        extractedAt: '2026-01-01T00:00:00.000Z',
        discrepancias: [],
      },
    });

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    // Submit immediately, without touching the radiogroup.
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockResolveExtraction).toHaveBeenCalledWith('org-1', 'typo-1', {
        action: 'ADOPT_EXTRACTED',
      });
    });
  });

  it('submits { action: ADOPT_EXTRACTED } with no nombre/codigo/version', async () => {
    mockResolveExtraction.mockResolvedValue(makeTypology());
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    await user.click(screen.getByText('Use what was extracted from the document'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockResolveExtraction).toHaveBeenCalledWith('org-1', 'typo-1', {
        action: 'ADOPT_EXTRACTED',
      });
    });
  });

  it('reveals manual fields for MANUAL_OVERRIDE and submits them', async () => {
    mockResolveExtraction.mockResolvedValue(makeTypology());
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    await user.click(screen.getByText('Enter the correct values'));

    const nombreInput = screen.getByLabelText('Name');
    const codigoInput = screen.getByLabelText('Code');
    const versionInput = screen.getByLabelText('Version');

    await user.clear(nombreInput);
    await user.type(nombreInput, 'Final Name');
    await user.clear(codigoInput);
    await user.type(codigoInput, 'FINAL-001');
    await user.clear(versionInput);
    await user.type(versionInput, 'v3.0');

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockResolveExtraction).toHaveBeenCalledWith('org-1', 'typo-1', {
        action: 'MANUAL_OVERRIDE',
        nombre: 'Final Name',
        codigo: 'FINAL-001',
        version: 'v3.0',
      });
    });
  });

  it('requires nombre, codigo and version when MANUAL_OVERRIDE fields are left blank', async () => {
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    await user.click(screen.getByText('Enter the correct values'));

    await user.clear(screen.getByLabelText('Name'));
    await user.clear(screen.getByLabelText('Code'));
    await user.clear(screen.getByLabelText('Version'));

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(screen.getAllByText('This field is required')).toHaveLength(3);
    });
    expect(mockResolveExtraction).not.toHaveBeenCalled();
  });

  it('disables Cancel and blocks closing while the resolve mutation is pending', async () => {
    let resolvePending!: (v: ApiTypology) => void;
    mockResolveExtraction.mockReturnValue(
      new Promise<ApiTypology>((resolve) => {
        resolvePending = resolve;
      }),
    );
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    await user.click(screen.getByText('Use what was extracted from the document'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeDisabled();

    // A disabled button ignores clicks — the dialog must stay open while pending.
    await user.click(cancelButton);
    expect(screen.getByText('Review document information')).toBeInTheDocument();

    resolvePending(makeTypology());
    await waitFor(() => {
      expect(screen.queryByText('Review document information')).not.toBeInTheDocument();
    });
  });

  it('moves focus and selection between radio options with arrow keys', async () => {
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowDown}');
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');

    await user.keyboard('{ArrowRight}');
    expect(radios[2]).toHaveFocus();
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');

    // Wraps around past the last option back to the first.
    await user.keyboard('{ArrowDown}');
    expect(radios[0]).toHaveFocus();
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    // Wraps around backwards past the first option to the last.
    await user.keyboard('{ArrowUp}');
    expect(radios[radios.length - 1]).toHaveFocus();
    expect(radios[radios.length - 1]).toHaveAttribute('aria-checked', 'true');
  });

  it('closes the dialog on Cancel without calling the API', async () => {
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Review document information')).not.toBeInTheDocument();
    });
    expect(mockResolveExtraction).not.toHaveBeenCalled();
  });

  it('shows the translated error message on a 409 conflict', async () => {
    mockResolveExtraction.mockRejectedValue({
      response: {
        data: {
          errorCode: 'TYPOLOGY_CODE_ALREADY_EXISTS',
          message: 'fallback',
          params: { codigo: 'POL-SEC-002' },
        },
      },
    });
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    await user.click(screen.getByText('Use what was extracted from the document'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await screen.findByText(
      'An active typology with code "POL-SEC-002" already exists in this organization. Only one active typology per code is allowed.',
    );
  });

  it('shows a guiding error when the backend rejects a still-mismatched KEEP_DECLARED resolution', async () => {
    mockResolveExtraction.mockRejectedValue({
      response: {
        data: {
          errorCode: 'TYPOLOGY_DECLARED_STILL_MISMATCHED',
          message: 'fallback',
          params: { fields: ['nombre'] },
        },
      },
    });
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    // "Keep what I entered" is selected by default for a DISCREPANCY typology.
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await screen.findByText(
      'The declared data still doesn\'t match the content of the uploaded document. Choose "Use what was extracted from the document", or upload a document whose content matches the declared data.',
    );
  });
});
