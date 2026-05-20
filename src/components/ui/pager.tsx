import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PagerProps {
  page: number
  totalPages: number
  total: number
  onChange: (p: number) => void
  className?: string
}

export function Pager({ page, totalPages, total, onChange, className }: PagerProps) {
  const { t } = useTranslation()
  return (
    <div className={`flex items-center justify-between text-sm text-muted-foreground ${className ?? ''}`}>
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
