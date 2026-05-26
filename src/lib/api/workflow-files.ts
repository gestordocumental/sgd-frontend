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
  ): Promise<{ signedUrl: string; expiresAt: string }> =>
    apiClient
      .post<{
        signedUrl: string;
        expiresAt: string;
      }>(`/documents/${orgId}/workflow-files/signed-url`, { storageKey })
      .then((r) => r.data),
};
