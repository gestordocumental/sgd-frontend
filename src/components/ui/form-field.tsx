import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}

export function FormField({ id, label, error, children }: FormFieldProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{t(error)}</p>}
    </div>
  )
}
