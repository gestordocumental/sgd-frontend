import { useState, useCallback } from 'react';
import { typologiesApi } from '@/lib/api/typologies';
import type { ExtractionResult } from './workflow-schemas';

export function useDocumentExtraction(companyId: string) {
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentExtraction, setDocumentExtraction] = useState<ExtractionResult | null>(null);
  const [documentExtractionLoading, setDocumentExtractionLoading] = useState(false);
  const [documentExtractionError, setDocumentExtractionError] = useState<string | null>(null);

  const handleDocumentFile = useCallback(
    async (file: File) => {
      setDocumentFile(file);
      setDocumentExtraction(null);
      setDocumentExtractionError(null);
      setDocumentExtractionLoading(true);
      try {
        const result = await typologiesApi.previewExtract(companyId, file);
        setDocumentExtraction(result);
      } catch {
        setDocumentExtractionError('No se pudo extraer la información del documento');
      } finally {
        setDocumentExtractionLoading(false);
      }
    },
    [companyId],
  );

  const reset = useCallback(() => {
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
    reset,
  };
}
