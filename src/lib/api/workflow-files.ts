import { apiClient } from './client';

export interface WorkflowFileUploadResponse {
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
}

export const workflowFilesApi = {
  upload: (orgId: string, file: File): Promise<WorkflowFileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient
      .post<WorkflowFileUploadResponse>(`/documents/${orgId}/workflow-files`, formData, {
        headers: { 'Content-Type': undefined },
      })
      .then((r) => r.data);
  },

  getSignedUrl: (
    orgId: string,
    storageKey: string,
    originalName?: string,
    mimeType?: string,
  ): Promise<{ signedUrl: string; expiresAt: string }> =>
    apiClient
      .post<{
        signedUrl: string;
        expiresAt: string;
      }>(`/documents/${orgId}/workflow-files/signed-url`, { storageKey, originalName, mimeType })
      .then((r) => r.data),

  // Fetches the raw file bytes through our own API (not a direct R2 signed
  // URL) — client-side preview libraries need fetch()-readable bytes, and the
  // R2 bucket has no CORS policy configured for direct browser access.
  getContent: (orgId: string, storageKey: string, mimeType?: string): Promise<ArrayBuffer> =>
    apiClient
      .post<ArrayBuffer>(
        `/documents/${orgId}/workflow-files/content`,
        { storageKey, mimeType },
        { responseType: 'arraybuffer' },
      )
      .then((r) => r.data),

  downloadZip: (
    orgId: string,
    files: Array<{ storageKey: string; zipPath: string }>,
    title: string,
  ): Promise<Blob> =>
    apiClient
      .post<Blob>(
        `/documents/${orgId}/workflow-files/download-zip`,
        { files, title },
        { responseType: 'blob', timeout: 120_000 },
      )
      .then((r) => r.data),
};
