import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockPreviewExtract = vi.fn();
vi.mock('@/lib/api/typologies', () => ({
  typologiesApi: { previewExtract: (...args: unknown[]) => mockPreviewExtract(...args) },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { useDocumentExtraction } from '../use-document-extraction';

const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

describe('useDocumentExtraction — expectedNombre', () => {
  beforeEach(() => {
    mockPreviewExtract.mockReset();
    mockPreviewExtract.mockResolvedValue({ nombre: 'N', codigo: 'C', version: '1' });
  });

  it('sends the expected name set before the file is picked', async () => {
    const { result } = renderHook(() => useDocumentExtraction('org-1'));
    act(() => result.current.setExpectedNombre('Manual de Calidad'));
    expect(mockPreviewExtract).not.toHaveBeenCalled();

    await act(() => result.current.handleDocumentFile(file));
    expect(mockPreviewExtract).toHaveBeenCalledWith('org-1', file, undefined, 'Manual de Calidad');
  });

  it('re-extracts the loaded file when the expected name changes', async () => {
    const { result } = renderHook(() => useDocumentExtraction('org-1'));
    await act(() => result.current.handleDocumentFile(file));
    expect(mockPreviewExtract).toHaveBeenLastCalledWith('org-1', file, undefined, undefined);

    act(() => result.current.setExpectedNombre('Política de Seguridad'));
    await waitFor(() => expect(mockPreviewExtract).toHaveBeenCalledTimes(2));
    expect(mockPreviewExtract).toHaveBeenLastCalledWith(
      'org-1',
      file,
      undefined,
      'Política de Seguridad',
    );

    // Same name again: no extra request.
    act(() => result.current.setExpectedNombre('Política de Seguridad'));
    expect(mockPreviewExtract).toHaveBeenCalledTimes(2);
  });

  it('does not re-extract after reset', async () => {
    const { result } = renderHook(() => useDocumentExtraction('org-1'));
    await act(() => result.current.handleDocumentFile(file));
    act(() => result.current.reset());
    act(() => result.current.setExpectedNombre('Otro nombre largo'));
    expect(mockPreviewExtract).toHaveBeenCalledTimes(1);
  });
});
