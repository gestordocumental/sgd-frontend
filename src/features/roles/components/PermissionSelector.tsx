import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import type { ApiPermission } from '@/lib/api/roles'

interface PermissionSelectorProps {
  permissions: ApiPermission[]
  selected: string[]
  onToggle: (id: string) => void
}

export function PermissionSelector({ permissions, selected, onToggle }: PermissionSelectorProps) {
  const { t } = useTranslation()
  const modules = useMemo(
    () => [...new Set(permissions.map((p) => p.module))],
    [permissions],
  )

  const getLabel = (p: ApiPermission) =>
    `${t(`permissions.actions.${p.action}`)} — ${t(`permissions.modules.${p.module}`)}`

  const getModuleLabel = (module: string) =>
    t(`permissions.modules.${module}`, { defaultValue: module })

  return (
    <div className="rounded-md border border-border p-3 space-y-3 max-h-64 overflow-y-auto">
      {modules.map((mod) => (
        <div key={mod}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {getModuleLabel(mod)}
          </p>
          <div className="space-y-1">
            {permissions
              .filter((p) => p.module === mod)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`perm-${p.id}`}
                    checked={selected.includes(p.id)}
                    onCheckedChange={() => onToggle(p.id)}
                  />
                  <label htmlFor={`perm-${p.id}`} className="text-sm cursor-pointer select-none">
                    {getLabel(p)}
                  </label>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
