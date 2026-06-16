import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pencil,
  Trash2,
  History,
  Eye,
  Download,
  FileUp,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { useTypologies } from '@/features/doc-governance/hooks/use-typologies';
import type { ApiTypology, ExtractionStatus, TypologyStatus } from '@/lib/api/typologies';
import { PAGE_SIZE, Pager, SearchInput, EmptyState } from '../org-structure-shared';

type TypologiesHook = ReturnType<typeof useTypologies>;

const typologyStatusClass: Record<TypologyStatus, string> = {
  INCOMPLETE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACTIVE: 'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  ARCHIVED: 'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
  DELETED: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
};

const extractionStatusClass: Record<ExtractionStatus, string> = {
  NOT_UPLOADED: 'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
  PROCESSING: 'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
  COMPLETED: 'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  DISCREPANCY: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  PENDING_CONFIRMATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  CONFIRMED: 'bg-teal-100   text-teal-800   dark:bg-teal-900/30   dark:text-teal-400',
  FAILED: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
};

interface TypologyTabContentProps {
  typologiesHook: TypologiesHook;
  canWrite?: boolean;
}

export function TypologyTabContent({ typologiesHook, canWrite = false }: TypologyTabContentProps) {
  const { t } = useTranslation();

  const [typoSearch, setTypoSearch] = useState('');
  const [typoStatus, setTypoStatus] = useState<TypologyStatus | 'all'>('all');
  const [typoPage, setTypoPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const TYPO_STATUS_OPTIONS: { value: TypologyStatus | 'all'; label: string }[] = [
    { value: 'all', label: t('common.all') },
    { value: 'ACTIVE', label: t('docGovernance.typologyStatus.ACTIVE') },
    { value: 'INCOMPLETE', label: t('docGovernance.typologyStatus.INCOMPLETE') },
    { value: 'ARCHIVED', label: t('docGovernance.typologyStatus.ARCHIVED') },
  ];

  const filteredTypos = typologiesHook.typologies.filter((ty: ApiTypology) => {
    const q = typoSearch.toLowerCase();
    const matchesSearch =
      !q ||
      (ty.datosDeclarados.nombre ?? '').toLowerCase().includes(q) ||
      (ty.datosDeclarados.codigo ?? '').toLowerCase().includes(q);
    const matchesStatus = typoStatus === 'all' || ty.typologyStatus === typoStatus;
    return matchesSearch && matchesStatus;
  });
  const typoTotalPages = Math.max(1, Math.ceil(filteredTypos.length / PAGE_SIZE));
  const typoSafePage = Math.min(typoPage, typoTotalPages);
  const paginatedTypos = filteredTypos.slice(
    (typoSafePage - 1) * PAGE_SIZE,
    typoSafePage * PAGE_SIZE,
  );

  return (
    <TabsContent value="typology" className="mt-4">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold shrink-0">{t('docGovernance.table.title')}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <SearchInput
              value={typoSearch}
              onChange={(v) => {
                setTypoSearch(v);
                setTypoPage(1);
              }}
              placeholder={t('common.search')}
            />
            <select
              aria-label={t('common.statusLabel')}
              value={typoStatus}
              onChange={(e) => {
                setTypoStatus(e.target.value as TypologyStatus | 'all');
                setTypoPage(1);
              }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
            >
              {TYPO_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {canWrite && (
              <Button size="sm" onClick={typologiesHook.openCreate}>
                <Plus className="size-4" /> {t('docGovernance.table.newTypology')}
              </Button>
            )}
          </div>
        </div>

        {typologiesHook.isLoading ? (
          <EmptyState message={t('common.loading')} />
        ) : filteredTypos.length === 0 ? (
          <EmptyState
            message={
              typoSearch || typoStatus !== 'all'
                ? t('common.noResults')
                : t('docGovernance.table.empty')
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('docGovernance.table.name')}</TableHead>
                  <TableHead>{t('docGovernance.table.code')}</TableHead>
                  <TableHead>{t('docGovernance.table.version')}</TableHead>
                  <TableHead>{t('docGovernance.table.department')}</TableHead>
                  <TableHead>{t('docGovernance.table.areaPosition')}</TableHead>
                  <TableHead>{t('docGovernance.table.status')}</TableHead>
                  <TableHead>{t('docGovernance.table.extraction')}</TableHead>
                  <TableHead>{t('audit.columns.correlationId')}</TableHead>
                  <TableHead className="w-28 text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTypos.map((typo: ApiTypology) => (
                  <TableRow key={typo.id}>
                    <TableCell className="font-medium">
                      {typo.datosDeclarados.nombre ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {typo.datosDeclarados.codigo ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {typo.datosDeclarados.version ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {typo.estructuraOrg.departamentoNombre}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[typo.estructuraOrg.areaNombre, typo.estructuraOrg.cargoNombre]
                        .filter(Boolean)
                        .join(' / ') || '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typologyStatusClass[typo.typologyStatus]}`}
                      >
                        {t(`docGovernance.typologyStatus.${typo.typologyStatus}`)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${extractionStatusClass[typo.documento.extractionStatus]}`}
                      >
                        {t(`docGovernance.extractionStatus.${typo.documento.extractionStatus}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="flex items-center gap-1 min-w-0">
                        <span
                          className="font-mono text-[11px] text-muted-foreground truncate max-w-[90px]"
                          title={typo.id}
                        >
                          {typo.id.slice(0, 8)}…
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 shrink-0"
                          title={t('audit.detail.copy')}
                          aria-label={t('audit.detail.copy')}
                          onClick={() => {
                            if (!navigator.clipboard?.writeText) return;
                            void navigator.clipboard
                              .writeText(typo.id)
                              .then(() => {
                                setCopiedId(typo.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              })
                              .catch(() => undefined);
                          }}
                        >
                          {copiedId === typo.id ? (
                            <Check className="size-3" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {typo.datosDeclarados.codigo && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title={t('docGovernance.table.viewHistory')}
                            aria-label={t('docGovernance.table.viewHistory')}
                            onClick={() => typologiesHook.setHistoryTypology(typo)}
                          >
                            <History className="size-3.5" />
                          </Button>
                        )}
                        {typo.documento.extractionStatus !== 'NOT_UPLOADED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title={
                              typo.documento.mimeType === 'application/pdf'
                                ? t('docGovernance.table.viewDocument')
                                : t('docGovernance.table.downloadDocument')
                            }
                            aria-label={
                              typo.documento.mimeType === 'application/pdf'
                                ? t('docGovernance.table.viewDocument')
                                : t('docGovernance.table.downloadDocument')
                            }
                            disabled={typologiesHook.viewDocumentMutation.isPending}
                            onClick={() => typologiesHook.viewDocumentMutation.mutate(typo.id)}
                          >
                            {typo.documento.mimeType === 'application/pdf' ? (
                              <Eye className="size-3.5" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                          </Button>
                        )}
                        {typo.documento.extractionStatus === 'FAILED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-amber-600 hover:text-amber-700"
                            title={t('docGovernance.table.retryExtraction')}
                            aria-label={t('docGovernance.table.retryExtraction')}
                            disabled={typologiesHook.retryExtractionMutation.isPending}
                            onClick={() => typologiesHook.retryExtractionMutation.mutate(typo.id)}
                          >
                            <RefreshCw className="size-3.5" />
                          </Button>
                        )}
                        {canWrite && (
                          <>
                            {typo.documento.extractionStatus === 'NOT_UPLOADED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-blue-600 hover:text-blue-700"
                                title={t('docGovernance.table.uploadDocument')}
                                aria-label={t('docGovernance.table.uploadDocument')}
                                onClick={() => typologiesHook.openUploadDoc(typo)}
                              >
                                <FileUp className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                              onClick={() => typologiesHook.openEdit(typo)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                              onClick={() => typologiesHook.setDeleteTypology(typo)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {typoTotalPages > 1 && (
              <Pager
                page={typoSafePage}
                totalPages={typoTotalPages}
                total={filteredTypos.length}
                onChange={setTypoPage}
              />
            )}
          </>
        )}
      </div>
    </TabsContent>
  );
}
