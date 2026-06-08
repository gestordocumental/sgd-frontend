import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Copy, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { orgStructureApi } from '@/lib/api/org-structure';
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

// Fields in audit changes that hold org-structure UUIDs
const ORG_STRUCTURE_FIELDS = new Set(['departamentoId', 'areaId', 'cargoId']);

type AuditChanges = Record<string, { from: unknown; to: unknown }>;

function isAuditChanges(value: unknown): value is AuditChanges {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) => entry && typeof entry === 'object' && 'from' in entry && 'to' in entry,
  );
}

function hasOrgStructureChanges(changes: AuditChanges | null): boolean {
  if (!changes) return false;
  return Object.keys(changes).some((k) => ORG_STRUCTURE_FIELDS.has(k));
}

interface AuditDetailModalProps {
  log: AuditLog;
  users: SimpleUser[];
  open: boolean;
  onClose: () => void;
  onFilterByCorrelation: (correlationId: string) => void;
  companyId?: string;
}

export function AuditDetailModal({
  log,
  users,
  open,
  onClose,
  onFilterByCorrelation,
  companyId,
}: AuditDetailModalProps) {
  const { t } = useTranslation();
  const rawChanges = log.metadata?.['changes'];
  const changes: AuditChanges | null = isAuditChanges(rawChanges) ? rawChanges : null;

  const orgId = companyId ?? log.orgId;
  const needsOrgLookup = !!orgId && hasOrgStructureChanges(changes);

  const { data: depts = [] } = useQuery({
    queryKey: ['departamentos', orgId],
    queryFn: () => orgStructureApi.listDepartamentos(orgId!),
    staleTime: 300_000,
    enabled: needsOrgLookup,
  });

  const { data: allAreas = [] } = useQuery({
    queryKey: ['all-areas', orgId],
    queryFn: () => orgStructureApi.listAllAreas(orgId!),
    staleTime: 300_000,
    enabled: needsOrgLookup,
  });

  const { data: allCargos = [] } = useQuery({
    queryKey: ['all-cargos', orgId],
    queryFn: () => orgStructureApi.listAllCargos(orgId!),
    staleTime: 300_000,
    enabled: needsOrgLookup,
  });

  const deptMap = new Map(depts.map((d) => [d.id, d.name]));
  const areaMap = new Map(allAreas.map((a) => [a.id, a.name]));
  const cargoMap = new Map(allCargos.map((c) => [c.id, c.name]));

  function resolveChangeValue(field: string, value: unknown): string {
    if (value == null || value === '') return '—';
    if (value === true) return t('common.active');
    if (value === false) return t('common.inactive');
    const str = String(value);
    if (field === 'departamentoId') return deptMap.get(str) ?? str;
    if (field === 'areaId') return areaMap.get(str) ?? str;
    if (field === 'cargoId') return cargoMap.get(str) ?? str;
    return str;
  }

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
                    onClick={() => {
                      if (!navigator.clipboard?.writeText) return;
                      void navigator.clipboard.writeText(log.correlationId!).catch(() => undefined);
                    }}
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
                            {resolveChangeValue(field, from)}
                          </span>
                          <span className="text-muted-foreground shrink-0">→</span>
                          <span className="text-green-600 break-words">
                            {resolveChangeValue(field, to)}
                          </span>
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
