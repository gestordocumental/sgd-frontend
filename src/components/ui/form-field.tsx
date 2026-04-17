import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  description?: string
  children: React.ReactNode
}

export function FormField({ id, label, error, description, children }: FormFieldProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{t(error)}</p>}
    </div>
  )
}
