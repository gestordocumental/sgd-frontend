import { useTranslation } from 'react-i18next';
import { Copy, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  type AuditLog,
  type SimpleUser,
  formatDate,
  formatAction,
  formatFieldName,
  resourceTypeColor,
  formatResourceType,
  resolveActorName,
  resolveResourceName,
} from './audit-table.utils';

function formatValue(value: unknown, t: (key: string) => string): string {
  if (value == null || value === '') return '—';
  if (value === true) return t('common.active');
  if (value === false) return t('common.inactive');
  return String(value);
}

interface AuditDetailModalProps {
  log: AuditLog;
  users: SimpleUser[];
  open: boolean;
  onClose: () => void;
  onFilterByCorrelation: (correlationId: string) => void;
}

export function AuditDetailModal({
  log,
  users,
  open,
  onClose,
  onFilterByCorrelation,
}: AuditDetailModalProps) {
  const { t } = useTranslation();
  const changes = (log.metadata?.['changes'] ?? null) as Record<
    string,
    { from: unknown; to: unknown }
  > | null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg w-full overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('audit.detail.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm overflow-y-auto max-h-[70vh]">
          {/* Campos principales */}
          <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 min-w-0">
            <span className="text-muted-foreground whitespace-nowrap">
              {t('audit.columns.timestamp')}
            </span>
            <span className="break-words">{formatDate(log.timestamp)}</span>

            <span className="text-muted-foreground whitespace-nowrap">
              {t('audit.columns.action')}
            </span>
            <span className="font-medium break-words">{formatAction(log.action, t)}</span>

            <span className="text-muted-foreground whitespace-nowrap">
              {t('audit.columns.resourceType')}
            </span>
            <span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${resourceTypeColor(log.resourceType)}`}
              >
                {formatResourceType(log.resourceType, t)}
              </span>
            </span>

            <span className="text-muted-foreground whitespace-nowrap">
              {t('audit.columns.resource')}
            </span>
            <span className="break-words">{resolveResourceName(log)}</span>

            <span className="text-muted-foreground whitespace-nowrap">
              {t('audit.columns.actor')}
            </span>
            <span className="break-words">{resolveActorName(log.actorId, users)}</span>

            {log.ip && (
              <>
                <span className="text-muted-foreground whitespace-nowrap">
                  {t('audit.columns.ip')}
                </span>
                <span className="font-mono text-xs break-all">{log.ip}</span>
              </>
            )}

            {log.correlationId && (
              <>
                <span className="text-muted-foreground whitespace-nowrap">
                  {t('audit.columns.correlationId')}
                </span>
                <span className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-xs truncate min-w-0">{log.correlationId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 shrink-0"
                    title={t('audit.detail.copy')}
                    onClick={() => navigator.clipboard.writeText(log.correlationId!)}
                  >
                    <Copy className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 shrink-0"
                    title={t('audit.detail.filterByCorrelation')}
                    onClick={() => {
                      onFilterByCorrelation(log.correlationId!);
                      onClose();
                    }}
                  >
                    <Filter className="size-3" />
                  </Button>
                </span>
              </>
            )}
          </div>

          {/* Cambios (solo en UPDATE) */}
          {changes && Object.keys(changes).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('audit.detail.changes')}
              </p>
              <div className="rounded-md border divide-y">
                {Object.entries(changes).map(([field, { from, to }]) => {
                  const isComplex = from === null && to === null;
                  return (
                    <div key={field} className="px-3 py-2 space-y-1">
                      <p className="text-xs font-medium">{formatFieldName(field, t)}</p>
                      {isComplex ? (
                        <p className="text-xs text-muted-foreground">
                          {t('audit.detail.modified')}
                        </p>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-xs min-w-0">
                          <span className="line-through text-red-500/80 break-words">
                            {formatValue(from, t)}
                          </span>
                          <span className="text-muted-foreground shrink-0">→</span>
                          <span className="text-green-600 break-words">{formatValue(to, t)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
