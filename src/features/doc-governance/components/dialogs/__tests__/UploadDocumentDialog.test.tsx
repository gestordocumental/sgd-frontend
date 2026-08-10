import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    resolveExtraction: vi.fn().mockResolvedValue({}),
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

// Matches the exact scenario reported: a typology with no document at all.
function makeIncompleteTypology(): ApiTypology {
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
    datosDeclarados: { nombre: null, codigo: null, version: null, fuente: 'MANUAL' },
    documento: {
      r2Key: null,
      originalName: null,
      mimeType: null,
      uploadedAt: null,
      extractionStatus: 'NOT_UPLOADED',
    },
    metadataExtraida: {
      nombre: null,
      codigo: null,
      version: null,
      extractedAt: null,
      discrepancias: [],
    },
    fuenteCreacion: 'MANUAL',
    reviewCycleEnabled: false,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function UploadDialogHarness({ typo }: { typo: ApiTypology }) {
  const hook = useTypologies('org-1');

  useEffect(() => {
    hook.openUploadDoc(typo);
    // openUploadDoc is stable across renders — safe to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createElement(UploadDocumentDialog, { hook });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UploadDocumentDialog — modal layout', () => {
  it('constrains its height and scrolls its own content instead of overflowing the viewport, for a typology with no document yet', async () => {
    // Regression: this dialog's DialogContent had no max-height or overflow
    // handling at all (unlike every sibling dialog — TypologyFormDialog,
    // ResolveExtractionDialog — which both opt into max-h-[90vh] + an
    // internal overflow-y-auto scroll area). Since @/components/ui/dialog's
    // base DialogContent provides no such constraint by default, a fixed,
    // centered dialog without it can grow taller than the viewport with no
    // way to scroll to the rest of it — exactly the reported "content
    // desbordado, barras de desplazamiento adicionales" on the "upload a
    // document for a typology that has none" flow.
    render(<UploadDialogHarness typo={makeIncompleteTypology()} />, { wrapper: makeWrapper() });

    const heading = await screen.findByRole('heading', { name: 'Upload document' });
    const dialogContent = heading.closest('[data-slot="dialog-content"]');
    expect(dialogContent).not.toBeNull();
    expect(dialogContent).toHaveClass('max-h-[90vh]');

    const scrollArea = dialogContent!.querySelector('form');
    expect(scrollArea).not.toBeNull();
    expect(scrollArea).toHaveClass('overflow-y-auto');
  });
});
