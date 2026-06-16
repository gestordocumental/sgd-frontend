import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CrashPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="size-12 text-destructive" />
      <h1 className="text-2xl font-semibold">{t('crash.title')}</h1>
      <p className="text-sm text-muted-foreground max-w-sm">{t('crash.description')}</p>
      <Button onClick={() => window.location.reload()}>{t('crash.reload')}</Button>
    </div>
  );
}
