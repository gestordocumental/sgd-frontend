import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith('en');

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs font-medium text-muted-foreground hover:text-foreground w-10"
      onClick={() => i18n.changeLanguage(isEn ? 'es' : 'en')}
      aria-label={isEn ? 'Cambiar idioma a español' : 'Switch language to English'}
      title={isEn ? 'Cambiar idioma a español' : 'Switch language to English'}
    >
      {isEn ? 'ES' : 'EN'}
    </Button>
  );
}
