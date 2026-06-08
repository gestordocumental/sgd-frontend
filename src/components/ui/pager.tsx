import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PagerProps {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
  className?: string;
}

export function Pager({ page, totalPages, total, onChange, className }: PagerProps) {
  const { t } = useTranslation();
  const safeTotalPages = Math.max(totalPages, 1);
  const safePage = Math.min(Math.max(page, 1), safeTotalPages);
  return (
    <div
      className={`flex items-center justify-between text-sm text-muted-foreground ${className ?? ''}`}
    >
      <span>{t('common.resultsCount', { count: total })}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={safePage <= 1}
          onClick={() => onChange(safePage - 1)}
          aria-label={t('common.prevPage')}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs">
          {safePage} / {safeTotalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={safePage >= safeTotalPages}
          onClick={() => onChange(safePage + 1)}
          aria-label={t('common.nextPage')}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
