import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

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
          className="text-[10px] px-1.5 shrink-0 border bg-brand-subtle text-brand border-brand-border"
        >
          {t('workflows.dialogs.documentMismatch')}
        </Badge>
      )}
    </div>
  );
}

export function ApprovalStepBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg: Record<string, string> = {
    WAITING: 'bg-muted text-muted-foreground border-muted-foreground/20',
    PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    REJECTED: 'bg-brand-subtle text-brand border-brand-border',
  };
  const entry = cfg[status];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 ${entry ?? ''}`}>
      {t(`workflows.approvalStepStatus.${status}`, { defaultValue: status })}
    </Badge>
  );
}
