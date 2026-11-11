import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { typologiesApi } from '@/lib/api/typologies';
import type { ExtractionResult } from './workflow-schemas';

export function useDocumentExtraction(companyId: string) {
  const { t } = useTranslation();
  const latestRequestId = useRef(0);
  // Nombre de la tipología seleccionada: el backend verifica que el documento lo
  // contenga en vez de adivinar el título. Se guarda en un ref (junto con el archivo)
  // para poder repetir la extracción cuando el usuario cambia de tipología con un
  // archivo ya cargado.
  const expectedNombreRef = useRef<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentExtraction, setDocumentExtraction] = useState<ExtractionResult | null>(null);
  const [documentExtractionLoading, setDocumentExtractionLoading] = useState(false);
  const [documentExtractionError, setDocumentExtractionError] = useState<string | null>(null);

  const handleDocumentFile = useCallback(
    async (file: File) => {
      const requestId = ++latestRequestId.current;
      fileRef.current = file;
      setDocumentFile(file);
      setDocumentExtraction(null);
      setDocumentExtractionError(null);
      setDocumentExtractionLoading(true);
      try {
        const result = await typologiesApi.previewExtract(
          companyId,
          file,
          undefined,
          expectedNombreRef.current ?? undefined,
        );
        if (requestId !== latestRequestId.current) return;
        setDocumentExtraction(result);
      } catch {
        if (requestId !== latestRequestId.current) return;
        setDocumentExtractionError(t('workflows.extractionFailed'));
      } finally {
        if (requestId === latestRequestId.current) {
          setDocumentExtractionLoading(false);
        }
      }
    },
    [companyId, t],
  );

  const setExpectedNombre = useCallback(
    (nombre: string | null) => {
      const next = nombre?.trim() || null;
      if (next === expectedNombreRef.current) return;
      expectedNombreRef.current = next;
      if (fileRef.current) void handleDocumentFile(fileRef.current);
    },
    [handleDocumentFile],
  );

  const reset = useCallback(() => {
    latestRequestId.current += 1;
    fileRef.current = null;
    setDocumentFile(null);
    setDocumentExtraction(null);
    setDocumentExtractionError(null);
    setDocumentExtractionLoading(false);
  }, []);

  return {
    documentFile,
    documentExtraction,
    documentExtractionLoading,
    documentExtractionError,
    handleDocumentFile,
    setExpectedNombre,
    reset,
  };
}
