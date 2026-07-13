import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Plus,
  Upload,
  Download,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure';
import type { BulkStructureResult } from '@/lib/api/org-structure';
import { resolveApiError } from '@/lib/utils/api-error';
import { PAGE_SIZE, Pager, SearchInput, EmptyState, Stat } from '../org-structure-shared';

type OrgStructureHook = ReturnType<typeof useOrgStructure>;

async function downloadTemplate(onError: () => void) {
  try {
    const { Workbook } = await import('exceljs');
    const headers = [
      'Departamento',
      'Descripción Departamento',
      'Área',
      'Descripción Área',
      'Cargo',
      'Descripción Cargo',
    ];
    const colWidths = [24, 30, 20, 28, 26, 30];
    const exampleRows = [
      [
        'Recursos Humanos',
        'Gestión del talento humano',
        'Selección',
        'Reclutamiento y selección',
        'Analista de Selección',
        'Gestiona procesos de selección',
      ],
      ['Recursos Humanos', '', 'Nómina', 'Liquidación de nómina', 'Auxiliar de Nómina', ''],
      [
        'Recursos Humanos',
        '',
        '',
        '',
        'Director de RR.HH.',
        'Cargo nivel departamento — dejar Área en blanco',
      ],
      [
        'Tecnología',
        'Área de sistemas e infraestructura',
        'Desarrollo',
        'Desarrollo de software',
        'Desarrollador Frontend',
        '',
      ],
      ['Tecnología', '', '', '', 'CTO', 'Cargo nivel departamento — sin área asignada'],
    ];

    const wb = new Workbook();

    const addSheet = (name: string, rowData: string[][]) => {
      const sheet = wb.addWorksheet(name);
      rowData.forEach((row) => sheet.addRow(row));
      colWidths.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
      });
    };

    addSheet('Estructura', [headers]);
    addSheet('Ejemplo', [headers, ...exampleRows]);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-estructura-organizacional.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch {
    onError();
  }
}

interface DepartamentosTabContentProps {
  hook: OrgStructureHook;
  canWrite?: boolean;
}

export function DepartamentosTabContent({ hook, canWrite = false }: DepartamentosTabContentProps) {
  const { t } = useTranslation();
  const {
    departamentos,
    deptLoading,
    setCreateDeptOpen,
    openEditDept,
    setDeleteDept,
    bulkImportMutation,
  } = hook;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkResult, setBulkResult] = useState<BulkStructureResult | null>(null);
  const [deptSearch, setDeptSearch] = useState('');
  const [deptPage, setDeptPage] = useState(1);

  const filteredDepts = departamentos.filter(
    (d) => !deptSearch || d.name.toLowerCase().includes(deptSearch.toLowerCase()),
  );
  const deptTotalPages = Math.max(1, Math.ceil(filteredDepts.length / PAGE_SIZE));
  const deptSafePage = Math.min(deptPage, deptTotalPages);
  const paginatedDepts = filteredDepts.slice(
    (deptSafePage - 1) * PAGE_SIZE,
    deptSafePage * PAGE_SIZE,
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    bulkImportMutation.mutate(file, {
      onSuccess: (result) => {
        setBulkResult(result);
        if (result.failed === 0) {
          toast.success(
            t('orgStructure.excel.importCompleted', {
              departments: result.departmentsCreated,
              areas: result.areasCreated,
              positions: result.positionsCreated,
            }),
          );
        } else {
          toast.warning(
            t('orgStructure.excel.importWithErrors', {
              failed: result.failed,
              total: result.totalRows,
            }),
          );
        }
      },
      onError: (err: unknown) => {
        const fallback = t('orgStructure.excel.importError');
        toast.error(resolveApiError(err, t, fallback) ?? fallback);
      },
    });
  };

  return (
    <>
      <TabsContent value="departamentos" className="mt-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold shrink-0">{t('orgStructure.departamentos')}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <SearchInput
                value={deptSearch}
                onChange={(v) => {
                  setDeptSearch(v);
                  setDeptPage(1);
                }}
                placeholder={t('common.search')}
              />
              {canWrite && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={bulkImportMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      <Upload className="size-4" />
                      {bulkImportMutation.isPending
                        ? t('orgStructure.excel.importing')
                        : t('orgStructure.excel.buttonLabel')}
                      <ChevronDown className="size-3.5 opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() =>
                          void downloadTemplate(() =>
                            toast.error(t('orgStructure.excel.importError')),
                          )
                        }
                      >
                        <Download className="size-4" />
                        {t('orgStructure.excel.downloadTemplate')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-4" />
                        {t('orgStructure.excel.importFile')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    onClick={() => {
                      hook.deptForm.reset({ name: '', description: '' });
                      setCreateDeptOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    {t('orgStructure.newDepartamento')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {deptLoading ? (
            <EmptyState message={t('common.loading')} />
          ) : filteredDepts.length === 0 ? (
            <EmptyState
              message={deptSearch ? t('common.noResults') : t('orgStructure.emptyDepartamentos')}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.description')}</TableHead>
                    {canWrite && (
                      <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDepts.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {d.description ?? '—'}
                      </TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                              onClick={() => openEditDept(d)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                              onClick={() => setDeleteDept(d)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {deptTotalPages > 1 && (
                <Pager
                  page={deptSafePage}
                  totalPages={deptTotalPages}
                  total={filteredDepts.length}
                  onChange={setDeptPage}
                />
              )}
            </>
          )}
        </div>
      </TabsContent>

      {/* Bulk import result dialog — co-located with file upload trigger */}
      <Dialog
        open={!!bulkResult}
        onOpenChange={(open) => {
          if (!open) setBulkResult(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('orgStructure.excel.importResult')}</DialogTitle>
          </DialogHeader>
          {bulkResult && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Stat label={t('orgStructure.excel.totalRows')} value={bulkResult.totalRows} />
                <Stat
                  label={t('orgStructure.excel.failed')}
                  value={bulkResult.failed}
                  highlight={bulkResult.failed > 0}
                />
                <Stat
                  label={t('orgStructure.excel.departmentsCreated')}
                  value={bulkResult.departmentsCreated}
                />
                <Stat
                  label={t('orgStructure.excel.departmentsExisting')}
                  value={bulkResult.departmentsExisting}
                />
                <Stat
                  label={t('orgStructure.excel.areasCreated')}
                  value={bulkResult.areasCreated}
                />
                <Stat
                  label={t('orgStructure.excel.areasExisting')}
                  value={bulkResult.areasExisting}
                />
                <Stat
                  label={t('orgStructure.excel.positionsCreated')}
                  value={bulkResult.positionsCreated}
                />
                <Stat
                  label={t('orgStructure.excel.positionsExisting')}
                  value={bulkResult.positionsExisting}
                />
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-medium text-destructive flex items-center gap-1.5">
                    <AlertCircle className="size-4" /> {t('orgStructure.excel.rowErrors')}
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {bulkResult.errors.map((err, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <span className="font-medium">
                          {t('orgStructure.excel.row', { number: err.row })}
                        </span>
                        {err.department && (
                          <span className="text-muted-foreground"> · {err.department}</span>
                        )}
                        <p className="text-destructive mt-0.5">{err.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {bulkResult.failed === 0 && (
                <p className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle className="size-4" /> {t('orgStructure.excel.importSuccess')}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
