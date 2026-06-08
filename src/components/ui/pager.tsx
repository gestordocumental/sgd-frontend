import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PagerProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pager({ page, totalPages, onChange, className }: PagerProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex items-center justify-end gap-1 text-sm text-muted-foreground ${className ?? ''}`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label={t('common.prevPage')}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="px-1 tabular-nums">
        {page} / {totalPages}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label={t('common.nextPage')}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
