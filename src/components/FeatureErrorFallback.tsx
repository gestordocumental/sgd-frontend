import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface Props {
  feature: string;
  onReset: () => void;
}

export function FeatureErrorFallback({ feature, onReset }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center min-h-[200px]">
      <AlertTriangle className="size-8 text-destructive" />
      <p className="text-sm font-medium">{t('featureError.title', { feature })}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{t('featureError.description')}</p>
      <Button size="sm" variant="outline" onClick={onReset}>
        {t('featureError.retry')}
      </Button>
    </div>
  );
}
