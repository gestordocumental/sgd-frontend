import { useState, useEffect } from 'react';
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
import { auditApi, type AuditLogEntry } from '@/lib/api/audit';
import { type SimpleUser, buildAuditExportRows } from './audit-table.utils';

const MAX_LIMIT_OPTIONS = [500, 1000, 2500, 5000];
const CORRELATION_EXPORT_LIMIT = 5000;

interface AuditExportModalProps {
  open: boolean;
  onClose: () => void;
  companyId?: string;
  defaultFrom?: string;
  defaultTo?: string;
  defaultCorrelationId?: string;
  users?: SimpleUser[];
}

export function AuditExportModal({
  open,
  onClose,
  companyId,
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

  // Sync props when modal reopens. Multiple synchronous setState calls are
  // intentional here (atomically reset all fields when open flips to true).
  // React 18 batches these into a single re-render automatically.
  useEffect(() => {
    if (!open) return;
    setCorrelationId(defaultCorrelationId ?? ''); // eslint-disable-line react-hooks/set-state-in-effect
    setFrom(defaultFrom ?? '');
    setTo(defaultTo ?? '');
    setError(null);
  }, [open, defaultCorrelationId, defaultFrom, defaultTo]);

  const trimmedCorrelationId = correlationId.trim();
  const byCorrelation = !!trimmedCorrelationId;

  function fetchAllByCorrelation(corrId: string): Promise<AuditLogEntry[]> {
    return auditApi.exportLogs({
      correlationId: corrId,
      orgId: companyId || undefined,
      limit: CORRELATION_EXPORT_LIMIT,
    });
  }

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
      const { Workbook } = await import('exceljs');
      const data = byCorrelation
        ? await fetchAllByCorrelation(trimmedCorrelationId)
        : await auditApi.exportLogs({
            orgId: companyId || undefined,
            from: from ? new Date(from).toISOString() : undefined,
            to: to ? new Date(to).toISOString() : undefined,
            limit,
          });

      if (data.length === 0) {
        setError(t('audit.export.empty'));
        return;
      }

      const rows = buildAuditExportRows(data, users, t);

      const wb = new Workbook();
      const ws = wb.addWorksheet(t('audit.title'));
      const headers = Object.keys(rows[0]);
      ws.addRow(headers);
      for (const row of rows) {
        ws.addRow(headers.map((h) => row[h as keyof typeof row]));
      }
      headers.forEach((key, i) => {
        const maxLen = rows.reduce((acc, r) => {
          const len = String(r[key as keyof typeof r] ?? '').length;
          return len > acc ? len : acc;
        }, key.length);
        ws.getColumn(i + 1).width = Math.max(maxLen, 10);
      });

      let filename: string;
      if (correlationId.trim()) {
        filename = `${t('audit.export.filePrefixCorrelation')}_${correlationId.trim().slice(0, 12)}.xlsx`;
      } else {
        const fromLabel = from
          ? new Date(from).toISOString().slice(0, 10)
          : t('audit.export.startLabel');
        const toLabel = to ? new Date(to).toISOString().slice(0, 10) : t('audit.export.endLabel');
        filename = `${t('audit.export.filePrefix')}_${fromLabel}_${toLabel}.xlsx`;
      }
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);

      onClose();
    } catch {
      setError(t('audit.export.error'));
    } finally {
      setLoading(false);
    }
  }

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
