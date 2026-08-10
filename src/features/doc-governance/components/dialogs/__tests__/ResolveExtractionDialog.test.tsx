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
import { UploadDocumentDialog } from '../UploadDocumentDialog';
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
    reviewCycleEnabled: false,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Renders both dialogs so we can assert the resolve dialog hands off to the
// upload-document dialog (same declared version, just a corrected file —
// not the edit/new-version dialog, which would force a version bump) when
// the user chooses to upload a corrected document.
function ResolveDialogHarness({ typo }: { typo: ApiTypology }) {
  const hook = useTypologies('org-1');

  useEffect(() => {
    hook.openResolve(typo);
    // openResolve is stable across renders — safe to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ResolveExtractionDialog hook={hook} />
      <UploadDocumentDialog hook={hook} />
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ResolveExtractionDialog', () => {
  it('shows the diff table and the extracted data that will be adopted', async () => {
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
    expect(screen.getAllByText('Security Policy v2').length).toBeGreaterThan(0);
  });

  it('only offers to adopt the extraction or upload a corrected document — no Keep/Manual options', async () => {
    const typo = makeTypology();
    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });

    await screen.findByText('Review document information');

    expect(
      screen.getByRole('button', { name: /Use what was extracted from the document/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload a corrected document/ })).toBeInTheDocument();
    expect(screen.queryByText('Keep what I entered')).not.toBeInTheDocument();
    expect(screen.queryByText('Enter the correct values')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('submits { action: ADOPT_EXTRACTED } when the primary action is clicked', async () => {
    mockResolveExtraction.mockResolvedValue(makeTypology());
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    await user.click(
      screen.getByRole('button', { name: /Use what was extracted from the document/ }),
    );

    await waitFor(() => {
      expect(mockResolveExtraction).toHaveBeenCalledWith('org-1', 'typo-1', {
        action: 'ADOPT_EXTRACTED',
      });
    });
  });

  it('closes the resolve dialog and opens the upload-document dialog (not the edit/new-version dialog) to upload a corrected document', async () => {
    // Regression: this used to hand off to the edit dialog, whose flow
    // (createNewVersion) requires the version to strictly increment — a
    // dead end for fixing a wrong file under the version that's already
    // declared, since the whole point is to NOT create a new version.
    const user = userEvent.setup();
    const typo = makeTypology();

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');

    await user.click(screen.getByRole('button', { name: /Upload a corrected document/ }));

    await waitFor(() => {
      expect(screen.queryByText('Review document information')).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('heading', { name: 'Upload document' })).toBeInTheDocument();
    expect(screen.queryByText('Edit typology')).not.toBeInTheDocument();
    expect(mockResolveExtraction).not.toHaveBeenCalled();
  });

  it('pre-fills the upload-document dialog with the current (unchanged) version and submits it without a version error', async () => {
    // Regression: the declared version is "v1.0" and the corrected file's
    // content matches it exactly — resolving the discrepancy this way must
    // not require bumping to "v1.1"/"v2.0". uploadDocument() (unlike
    // newVersion()) never validates the version at all, so once routed
    // there this succeeds with the version left exactly as declared.
    const user = userEvent.setup();
    const typo = makeTypology({
      datosDeclarados: {
        nombre: 'Security Policy',
        codigo: 'POL-SEC-001',
        version: 'v1.0',
        fuente: 'MANUAL',
      },
    });

    render(<ResolveDialogHarness typo={typo} />, { wrapper: makeWrapper() });
    await screen.findByText('Review document information');
    await user.click(screen.getByRole('button', { name: /Upload a corrected document/ }));
    await screen.findByRole('heading', { name: 'Upload document' });

    const versionInput = screen.getByLabelText('Version') as HTMLInputElement;
    expect(versionInput.value).toBe('v1.0');

    const file = new File(['content'], 'corrected.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: 'Upload document' }));

    expect(
      screen.queryByText(/must be the same as the current one|incremented by exactly one unit/),
    ).not.toBeInTheDocument();
  });

  it('disables both actions and blocks closing while the resolve mutation is pending', async () => {
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

    await user.click(
      screen.getByRole('button', { name: /Use what was extracted from the document/ }),
    );

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /Upload a corrected document/ })).toBeDisabled();

    // A disabled button ignores clicks — the dialog must stay open while pending.
    await user.click(cancelButton);
    expect(screen.getByText('Review document information')).toBeInTheDocument();

    resolvePending(makeTypology());
    await waitFor(() => {
      expect(screen.queryByText('Review document information')).not.toBeInTheDocument();
    });
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

    await user.click(
      screen.getByRole('button', { name: /Use what was extracted from the document/ }),
    );

    await screen.findByText(
      'An active typology with code "POL-SEC-002" already exists in this organization. Only one active typology per code is allowed.',
    );
  });

  it('shows a guiding error if the backend still rejects the resolution as mismatched', async () => {
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

    await user.click(
      screen.getByRole('button', { name: /Use what was extracted from the document/ }),
    );

    await screen.findByText(
      'The declared data still doesn\'t match the content of the uploaded document. Choose "Use what was extracted from the document", or upload a document whose content matches the declared data.',
    );
  });
});
