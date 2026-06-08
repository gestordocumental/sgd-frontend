import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageNumberPagerProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  total?: number;
  hasPrev?: never;
  hasNext?: never;
  onPrev?: never;
  onNext?: never;
}

interface PrevNextPagerProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  page?: never;
  totalPages?: never;
  total?: never;
  onChange?: never;
}

type PagerProps = (PageNumberPagerProps | PrevNextPagerProps) & {
  className?: string;
};

export function Pager(props: PagerProps) {
  const { t } = useTranslation();

  if (typeof props.onChange === 'function') {
    const { page, totalPages, total, onChange, className } = props;
    return (
      <div
        className={`flex items-center gap-1 text-sm text-muted-foreground ${
          typeof total === 'number' ? 'justify-between' : 'justify-end'
        } ${className ?? ''}`}
      >
        {typeof total === 'number' && <span>{t('common.resultsCount', { count: total })}</span>}
        <div className="flex items-center gap-1">
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
      </div>
    );
  }

  const { hasPrev, hasNext, onPrev, onNext, className } = props;
  return (
    <div
      className={`flex items-center justify-end gap-1 text-sm text-muted-foreground ${className ?? ''}`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={!hasPrev}
        onClick={onPrev}
        aria-label={t('common.prevPage')}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={!hasNext}
        onClick={onNext}
        aria-label={t('common.nextPage')}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
