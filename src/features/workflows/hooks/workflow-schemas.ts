import { z } from 'zod';

export const createWorkflowSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres').max(500, 'Máximo 500 caracteres'),
  description: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
});

export const approveSchema = z.object({
  observations: z.string().max(2000).optional(),
});

export const rejectSchema = z.object({
  observations: z.string().min(10, 'Mínimo 10 caracteres').max(3000, 'Máximo 3000 caracteres'),
});

export type CreateWorkflowForm = z.infer<typeof createWorkflowSchema>;
export type ApproveForm = z.infer<typeof approveSchema>;
export type RejectForm = z.infer<typeof rejectSchema>;

export type WorkflowsInnerTab = 'all' | 'my-tasks' | 'my-available';

export interface ExtractionResult {
  nombre: string | null;
  codigo: string | null;
  version: string | null;
}

/** null = la tipología no tiene valor declarado para ese campo */
export interface DocumentComparison {
  nombre: boolean | null;
  codigo: boolean | null;
  version: boolean | null;
}
