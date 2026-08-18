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

/**
 * Compara dos strings de versión ignorando ceros a la izquierda en cada
 * segmento y un prefijo `v` opcional — así "6" y "06" (o "v1.2" y "1.02")
 * se consideran la misma versión. Si alguno de los dos valores no es una
 * versión numérica con puntos, compara como texto plano (recortado), para
 * no alterar el comportamiento con esquemas de versión no numéricos.
 */
export function versionsEqual(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;

  // Segments are compared as strings (after stripping leading zeros), not
  // converted to Number — a Number round-trip would silently lose precision
  // past Number.MAX_SAFE_INTEGER and could make two different large version
  // numbers compare as equal.
  const parse = (v: string): string[] | null => {
    const normalized = v.trim().replace(/^v/i, '');
    if (!/^\d+(\.\d+)*$/.test(normalized)) return null;
    return normalized.split('.').map((segment) => segment.replace(/^0+(?=\d)/, ''));
  };

  const av = parse(a);
  const bv = parse(b);
  if (!av || !bv) return a.trim() === b.trim();

  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    if ((av[i] ?? '0') !== (bv[i] ?? '0')) return false;
  }
  return true;
}
