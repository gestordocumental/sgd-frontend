import type { useTypologies } from '@/features/doc-governance/hooks/use-typologies'
import type { TypologyStatus } from '@/lib/api/typologies'

export type TypologiesHook = ReturnType<typeof useTypologies>

export const ACCEPTED = '.pdf,.docx,.xlsx'
export const MAX_MB   = 20

export const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

// CSS-only map — not translatable, stays static
export const typologyStatusClass: Record<TypologyStatus, string> = {
  INCOMPLETE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACTIVE:     'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  ARCHIVED:   'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
  DELETED:    'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: '2-digit' })
}
