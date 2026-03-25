import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import type { ApiPermission } from '@/lib/api/roles'

interface PermissionSelectorProps {
  permissions: ApiPermission[]
  selected: string[]
  onToggle: (id: string) => void
}

export function PermissionSelector({ permissions, selected, onToggle }: PermissionSelectorProps) {
  const categories = useMemo(
    () => [...new Set(permissions.map((p) => p.category))],
    [permissions],
  )

  return (
    <div className="rounded-md border border-border p-3 space-y-3 max-h-64 overflow-y-auto">
      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {cat}
          </p>
          <div className="space-y-1">
            {permissions
              .filter((p) => p.category === cat)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`perm-${p.id}`}
                    checked={selected.includes(p.id)}
                    onCheckedChange={() => onToggle(p.id)}
                  />
                  <label htmlFor={`perm-${p.id}`} className="text-sm cursor-pointer select-none">
                    {p.label}
                  </label>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
