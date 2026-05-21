import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ACCEPTED, MAX_MB } from './typology-dialog-shared'

interface FilePickerProps {
  file: File | null
  onChange: (f: File) => void
  onClear: () => void
}

export function FilePicker({ file, onChange, onClear }: FilePickerProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    if (f.size > MAX_MB * 1024 * 1024) {
      alert(t('docGovernance.file.sizeError', { maxMb: MAX_MB }))
      return
    }
    onChange(f)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        type="file"
        accept={ACCEPTED}
        aria-label={t('docGovernance.file.selectLabel')}
        className="hidden"
        onChange={handleChange}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm flex-1 min-w-0">
          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            aria-label={t('docGovernance.file.clearLabel')}
            onClick={onClear}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => ref.current?.click()}
        >
          <Upload className="size-4" /> {t('docGovernance.file.selectLabel')}
        </Button>
      )}
      <span className="text-xs text-muted-foreground shrink-0">
        {t('docGovernance.file.hint', { maxMb: MAX_MB })}
      </span>
    </div>
  )
}
