import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ApiUserWithRoles } from '@/lib/api/users';

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground shrink-0 w-24">{label}</span>
      <div className="flex items-center flex-wrap gap-1">{children}</div>
    </div>
  );
}

export function ExtractionComparisonRow({
  label,
  extracted,
  match,
}: {
  label: string;
  extracted: string | null;
  match: boolean | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="flex-1 font-mono truncate text-foreground">{extracted ?? '—'}</span>
      {match === undefined ? null : match ? (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 shrink-0 bg-green-50 text-green-700 border-green-200"
        >
          {t('workflows.dialogs.documentMatch')}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 shrink-0 bg-destructive/10 text-destructive border-destructive/20"
        >
          {t('workflows.dialogs.documentMismatch')}
        </Badge>
      )}
    </div>
  );
}

// Renders the approver list with a working drag handle: HTML5 native drag
// and drop (no dnd-kit/react-beautiful-dnd dependency — the list is short
// and mouse-driven, so the browser's own DnD is enough) reorders the array
// via `onReorder`, replacing what used to be a GripVertical icon with no
// drag handlers wired to it at all — it looked draggable but did nothing.
export function ApproversList({
  approvers,
  onReorder,
  onRemove,
  removeLabel,
}: {
  approvers: { id: string; user: ApiUserWithRoles | undefined }[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  removeLabel: string;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (approvers.length === 0) return null;

  return (
    <div className="rounded-md border border-border divide-y divide-border">
      {approvers.map(({ id, user }, index) => (
        <div
          key={id}
          draggable
          onDragStart={() => setDraggedIndex(index)}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragOverIndex !== index) setDragOverIndex(index);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedIndex !== null && draggedIndex !== index) onReorder(draggedIndex, index);
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
          onDragEnd={() => {
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
          className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
            draggedIndex === index ? 'opacity-40' : ''
          } ${
            dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
              ? 'bg-muted/60'
              : ''
          }`}
        >
          <GripVertical className="size-3.5 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />
          <div className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : id}
            </p>
            {user?.position && (
              <p className="text-xs text-muted-foreground truncate">{user.position}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={removeLabel}
            className="size-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onRemove(id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function ApprovalStepBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg: Record<string, string> = {
    WAITING: 'bg-muted text-muted-foreground border-muted-foreground/20',
    PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  const entry = cfg[status];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 ${entry ?? ''}`}>
      {t(`workflows.approvalStepStatus.${status}`, { defaultValue: status })}
    </Badge>
  );
}
