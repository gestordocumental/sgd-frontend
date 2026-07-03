import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { typologiesApi } from '@/lib/api/typologies';
import type { ExtractionResult } from './workflow-schemas';

export function useDocumentExtraction(companyId: string) {
  const { t } = useTranslation();
  const latestRequestId = useRef(0);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentExtraction, setDocumentExtraction] = useState<ExtractionResult | null>(null);
  const [documentExtractionLoading, setDocumentExtractionLoading] = useState(false);
  const [documentExtractionError, setDocumentExtractionError] = useState<string | null>(null);

  const handleDocumentFile = useCallback(
    async (file: File) => {
      const requestId = ++latestRequestId.current;
      setDocumentFile(file);
      setDocumentExtraction(null);
      setDocumentExtractionError(null);
      setDocumentExtractionLoading(true);
      try {
        const result = await typologiesApi.previewExtract(companyId, file);
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

  const reset = useCallback(() => {
    latestRequestId.current += 1;
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
