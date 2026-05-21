import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const PAGE_SIZE = 15

export const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

export function Pager({ page, totalPages, total, onChange }: {
  page: number; totalPages: number; total: number; onChange: (p: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm text-muted-foreground">
      <span>{t('common.resultsCount', { count: total })}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-7" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs">{page} / {totalPages}</span>
        <Button variant="ghost" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 w-44 text-sm"
      />
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function Stat({ label, value, highlight = false }: {
  label: string; value: number; highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight && value > 0 ? 'font-semibold text-destructive' : 'font-semibold'}>{value}</span>
    </div>
  )
}
