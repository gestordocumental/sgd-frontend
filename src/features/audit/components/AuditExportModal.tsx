import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Download, Link } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { auditApi } from '@/lib/api/audit';
import { type SimpleUser, resolveActorName } from './audit-table.utils';

const MAX_LIMIT_OPTIONS = [500, 1000, 2500, 5000];

interface AuditExportModalProps {
  open: boolean;
  onClose: () => void;
  defaultFrom?: string;
  defaultTo?: string;
  defaultCorrelationId?: string;
  users?: SimpleUser[];
}

export function AuditExportModal({
  open,
  onClose,
  defaultFrom,
  defaultTo,
  defaultCorrelationId,
  users = [],
}: AuditExportModalProps) {
  const { t } = useTranslation();

  const [correlationId, setCorrelationId] = useState(defaultCorrelationId ?? '');
  const [from, setFrom] = useState(defaultFrom ?? '');
  const [to, setTo] = useState(defaultTo ?? '');
  const [limit, setLimit] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync props when modal reopens
  useEffect(() => {
    if (open) {
      setCorrelationId(defaultCorrelationId ?? '');
      setFrom(defaultFrom ?? '');
      setTo(defaultTo ?? '');
      setError(null);
    }
  }, [open, defaultCorrelationId, defaultFrom, defaultTo]);

  // When a correlation ID is set, force max limit to get all events
  const effectiveLimit = correlationId.trim() ? 5000 : limit;

  function isoToLocal(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function handleExport() {
    setError(null);
    setLoading(true);
    try {
      const data = await auditApi.exportLogs({
        correlationId: correlationId.trim() || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        limit: effectiveLimit,
      });

      if (data.length === 0) {
        setError(t('audit.export.empty'));
        return;
      }

      const rows = data.map((log) => {
        const changes = (log.metadata?.['changes'] ?? null) as Record<
          string,
          { from: unknown; to: unknown }
        > | null;
        const changesText = changes
          ? Object.entries(changes)
              .map(([field, { from: f, to: tv }]) =>
                f === null && tv === null
                  ? `${field}: modificado`
                  : `${field}: "${f === true ? t('common.active') : f === false ? t('common.inactive') : (f ?? '—')}" → "${tv === true ? t('common.active') : tv === false ? t('common.inactive') : (tv ?? '—')}"`,
              )
              .join(' | ')
          : '';

        return {
          [t('audit.columns.timestamp')]: new Date(log.timestamp).toLocaleString(),
          [t('audit.columns.action')]: log.action.replace(/_/g, ' '),
          [t('audit.columns.resourceType')]: log.resourceType,
          [t('audit.columns.resource')]: log.resourceName ?? log.resourceId,
          [t('audit.columns.actor')]: resolveActorName(log.actorId, users),
          [t('audit.columns.ip')]: log.ip ?? '',
          [t('audit.columns.correlationId')]: log.correlationId ?? '',
          [t('audit.detail.changes')]: changesText,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t('audit.title'));

      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(
          key.length,
          ...rows.map((r) => String(r[key as keyof typeof r] ?? '').length),
          10,
        ),
      }));
      ws['!cols'] = colWidths;

      let filename: string;
      if (correlationId.trim()) {
        filename = `auditoria_correlacion_${correlationId.trim().slice(0, 12)}.xlsx`;
      } else {
        const fromLabel = from ? new Date(from).toISOString().slice(0, 10) : 'inicio';
        const toLabel = to ? new Date(to).toISOString().slice(0, 10) : 'fin';
        filename = `auditoria_${fromLabel}_${toLabel}.xlsx`;
      }
      XLSX.writeFile(wb, filename);

      onClose();
    } catch {
      setError(t('audit.export.error'));
    } finally {
      setLoading(false);
    }
  }

  const byCorrelation = !!correlationId.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('audit.export.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Correlation ID — exporta TODOS los eventos de ese ID */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Link className="size-3" />
              {t('audit.export.byCorrelationId')}
            </label>
            <Input
              className="h-8 text-xs font-mono"
              placeholder={t('audit.filters.correlationIdPlaceholder')}
              value={correlationId}
              onChange={(e) => setCorrelationId(e.target.value)}
            />
            {byCorrelation && (
              <p className="text-[11px] text-muted-foreground">
                {t('audit.export.correlationNote')}
              </p>
            )}
          </div>

          {/* Separador visual */}
          {!byCorrelation && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-[11px] text-muted-foreground">
                  {t('audit.export.orByDate')}
                </span>
              </div>
            </div>
          )}

          {/* Rango de fechas — opcional cuando hay correlationId */}
          {!byCorrelation && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{t('audit.filters.from')}</label>
                <Input
                  type="datetime-local"
                  className="h-8 text-xs"
                  value={isoToLocal(from)}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{t('audit.filters.to')}</label>
                <Input
                  type="datetime-local"
                  className="h-8 text-xs"
                  value={isoToLocal(to)}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  {t('audit.export.maxRecords')}
                </label>
                <select
                  className="h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  {MAX_LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n.toLocaleString()} {t('audit.events')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleExport} disabled={loading}>
            <Download className="size-3.5" />
            {loading ? t('audit.export.downloading') : t('audit.export.download')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
