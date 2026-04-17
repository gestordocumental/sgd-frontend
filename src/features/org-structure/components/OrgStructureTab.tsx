import { Pencil, Trash2, Plus, Upload, Download, ChevronDown, CheckCircle, AlertCircle, FileUp, History, Eye, RefreshCw } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure'
import type { BulkStructureResult } from '@/lib/api/org-structure'
import { TypologyDialogs } from '@/features/doc-governance/components/TypologyDialogs'
import type { useTypologies } from '@/features/doc-governance/hooks/use-typologies'
import type { ApiTypology, ExtractionStatus, TypologyStatus } from '@/lib/api/typologies'

function downloadTemplate() {
  const headers = [
    'Departamento',
    'Descripción Departamento',
    'Área',
    'Descripción Área',
    'Cargo',
    'Descripción Cargo',
  ]
  const colWidths = [
    { wch: 24 }, { wch: 30 }, { wch: 20 }, { wch: 28 }, { wch: 26 }, { wch: 30 },
  ]

  // Hoja importable — solo encabezados, sin datos de ejemplo
  const ws = XLSX.utils.aoa_to_sheet([headers])
  ws['!cols'] = colWidths

  // Hoja de ejemplo — para orientar al usuario sin riesgo de importar datos reales
  const exampleRows = [
    ['Recursos Humanos', 'Gestión del talento humano', 'Selección', 'Reclutamiento y selección', 'Analista de Selección', 'Gestiona procesos de selección'],
    ['Recursos Humanos', '', 'Nómina', 'Liquidación de nómina', 'Auxiliar de Nómina', ''],
    ['Tecnología', 'Área de sistemas e infraestructura', 'Desarrollo', 'Desarrollo de software', 'Desarrollador Frontend', ''],
  ]
  const exampleSheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows])
  exampleSheet['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Estructura')
  XLSX.utils.book_append_sheet(wb, exampleSheet, 'Ejemplo')
  XLSX.writeFile(wb, 'plantilla-estructura-organizacional.xlsx')
}

type OrgStructureHook = ReturnType<typeof useOrgStructure>
type TypologiesHook   = ReturnType<typeof useTypologies>

interface OrgStructureTabProps {
  hook: OrgStructureHook
  typologiesHook: TypologiesHook
  canWrite?: boolean
}

const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

// ── Typology / extraction status CSS classes (not translatable) ────────────

const typologyStatusClass: Record<TypologyStatus, string> = {
  INCOMPLETE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACTIVE:     'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  ARCHIVED:   'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
  DELETED:    'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
}

const extractionStatusClass: Record<ExtractionStatus, string> = {
  NOT_UPLOADED:         'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
  PROCESSING:           'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
  COMPLETED:            'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  DISCREPANCY:          'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  PENDING_CONFIRMATION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONFIRMED:            'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  FAILED:               'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-400',
}

export function OrgStructureTab({ hook, typologiesHook, canWrite = false }: OrgStructureTabProps) {
  const { t } = useTranslation()
  const {
    departamentos, deptLoading,
    areas, areasLoading,
    cargos, cargosLoading,
    selectedDeptId, handleSelectDept,
    selectedAreaId, setSelectedAreaId,
    setCreateDeptOpen, openEditDept, setDeleteDept,
    setCreateAreaOpen, openEditArea, setDeleteArea,
    setCreateCargoOpen, openEditCargo, setDeleteCargo,
    bulkImportMutation,
  } = hook

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bulkResult, setBulkResult] = useState<BulkStructureResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    bulkImportMutation.mutate(file, {
      onSuccess: (result) => {
        setBulkResult(result)
        if (result.failed === 0) {
          toast.success(t('orgStructure.excel.importCompleted', { departments: result.departmentsCreated, areas: result.areasCreated, positions: result.positionsCreated }))
        } else {
          toast.warning(t('orgStructure.excel.importWithErrors', { failed: result.failed, total: result.totalRows }))
        }
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('orgStructure.excel.importError')
        toast.error(msg)
      },
    })
  }

  return (
    <main className="p-6 space-y-6">
      <Tabs defaultValue="departamentos">
        <TabsList>
          <TabsTrigger value="departamentos">{t('orgStructure.departamentos')}</TabsTrigger>
          <TabsTrigger value="areas">{t('orgStructure.areas')}</TabsTrigger>
          <TabsTrigger value="cargos">{t('orgStructure.cargos')}</TabsTrigger>
          <TabsTrigger value="typology">{t('docGovernance.table.title')}</TabsTrigger>
        </TabsList>

        {/* ── Departamentos ─────────────────────────────────────── */}
        <TabsContent value="departamentos" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('orgStructure.departamentos')}</h2>
              {canWrite && (
                <div className="flex items-center gap-2">
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
                      {bulkImportMutation.isPending ? t('orgStructure.excel.importing') : t('orgStructure.excel.buttonLabel')}
                      <ChevronDown className="size-3.5 opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={downloadTemplate}>
                        <Download className="size-4" />
                        {t('orgStructure.excel.downloadTemplate')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-4" />
                        {t('orgStructure.excel.importFile')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" onClick={() => { hook.deptForm.reset(); setCreateDeptOpen(true) }}>
                    <Plus className="size-4" />{t('orgStructure.newDepartamento')}
                  </Button>
                </div>
              )}
            </div>

            {deptLoading ? (
              <EmptyState message={t('common.loading')} />
            ) : departamentos.length === 0 ? (
              <EmptyState message={t('orgStructure.emptyDepartamentos')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.description')}</TableHead>
                    {canWrite && <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departamentos.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.description ?? '—'}</TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7" title={t('common.edit')} onClick={() => openEditDept(d)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title={t('common.delete')} onClick={() => setDeleteDept(d)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Áreas ─────────────────────────────────────────────── */}
        <TabsContent value="areas" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium shrink-0">{t('orgStructure.departamento')}:</label>
            <select
              className={selectClass}
              value={selectedDeptId}
              onChange={(e) => handleSelectDept(e.target.value)}
            >
              <option value="">{t('orgStructure.selectDepartamento')}</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {selectedDeptId && canWrite && (
              <Button size="sm" onClick={() => { hook.areaForm.reset(); setCreateAreaOpen(true) }}>
                <Plus className="size-4" />{t('orgStructure.newArea')}
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {!selectedDeptId ? (
              <EmptyState message={t('orgStructure.selectDepartamentoFirst')} />
            ) : areasLoading ? (
              <EmptyState message={t('common.loading')} />
            ) : areas.length === 0 ? (
              <EmptyState message={t('orgStructure.emptyAreas')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.description')}</TableHead>
                    {canWrite && <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areas.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.description ?? '—'}</TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7" title={t('common.edit')} onClick={() => openEditArea(a)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title={t('common.delete')} onClick={() => setDeleteArea(a)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Cargos ────────────────────────────────────────────── */}
        <TabsContent value="cargos" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium shrink-0">{t('orgStructure.departamento')}:</label>
            <select
              className={selectClass}
              value={selectedDeptId}
              onChange={(e) => handleSelectDept(e.target.value)}
            >
              <option value="">{t('orgStructure.selectDepartamento')}</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <label className="text-sm font-medium shrink-0">{t('orgStructure.area')}:</label>
            <select
              className={selectClass}
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              disabled={!selectedDeptId}
            >
              <option value="">{t('orgStructure.selectArea')}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {selectedDeptId && selectedAreaId && canWrite && (
              <Button size="sm" onClick={() => { hook.cargoForm.reset(); setCreateCargoOpen(true) }}>
                <Plus className="size-4" />{t('orgStructure.newCargo')}
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {!selectedDeptId || !selectedAreaId ? (
              <EmptyState message={t('orgStructure.selectAreaFirst')} />
            ) : cargosLoading ? (
              <EmptyState message={t('common.loading')} />
            ) : cargos.length === 0 ? (
              <EmptyState message={t('orgStructure.emptyCargos')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.description')}</TableHead>
                    {canWrite && <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargos.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.description ?? '—'}</TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7" title={t('common.edit')} onClick={() => openEditCargo(c)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title={t('common.delete')} onClick={() => setDeleteCargo(c)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Typology ──────────────────────────────────────────── */}
        <TabsContent value="typology" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('docGovernance.table.title')}</h2>
              {canWrite && (
                <Button size="sm" onClick={typologiesHook.openCreate}>
                  <Plus className="size-4" /> {t('docGovernance.table.newTypology')}
                </Button>
              )}
            </div>

            {typologiesHook.isLoading ? (
              <EmptyState message={t('common.loading')} />
            ) : typologiesHook.typologies.length === 0 ? (
              <EmptyState message={t('docGovernance.table.empty')} />
            ) : (
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
                    <TableHead className="w-28 text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typologiesHook.typologies.map((typo: ApiTypology) => (
                    <TableRow key={typo.id}>
                      <TableCell className="font-medium">
                        {typo.datosDeclarados.nombre ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {typo.datosDeclarados.codigo ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {typo.datosDeclarados.version ?? <span className="text-muted-foreground">—</span>}
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
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typologyStatusClass[typo.typologyStatus]}`}>
                          {t(`docGovernance.typologyStatus.${typo.typologyStatus}`)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${extractionStatusClass[typo.documento.extractionStatus]}`}>
                          {t(`docGovernance.extractionStatus.${typo.documento.extractionStatus}`)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {typo.datosDeclarados.codigo && (
                            <Button
                              variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground"
                              title={t('docGovernance.table.viewHistory')}
                              onClick={() => typologiesHook.setHistoryTypology(typo)}
                            >
                              <History className="size-3.5" />
                            </Button>
                          )}
                          {typo.documento.extractionStatus !== 'NOT_UPLOADED' && (
                            <Button
                              variant="ghost" size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title={typo.documento.mimeType === 'application/pdf'
                                ? t('docGovernance.table.viewDocument')
                                : t('docGovernance.table.downloadDocument')}
                              disabled={typologiesHook.viewDocumentMutation.isPending}
                              onClick={() => typologiesHook.viewDocumentMutation.mutate(typo.id)}
                            >
                              {typo.documento.mimeType === 'application/pdf'
                                ? <Eye className="size-3.5" />
                                : <Download className="size-3.5" />}
                            </Button>
                          )}
                          {typo.documento.extractionStatus === 'FAILED' && (
                            <Button
                              variant="ghost" size="icon"
                              className="size-7 text-amber-600 hover:text-amber-700"
                              title={t('docGovernance.table.retryExtraction')}
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
                                  variant="ghost" size="icon" className="size-7 text-blue-600 hover:text-blue-700"
                                  title={t('docGovernance.table.uploadDocument')}
                                  onClick={() => typologiesHook.openUploadDoc(typo)}
                                >
                                  <FileUp className="size-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="size-7" title={t('common.edit')} onClick={() => typologiesHook.openEdit(typo)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title={t('common.delete')} onClick={() => typologiesHook.setDeleteTypology(typo)}>
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
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Bulk import result dialog ──────────────────────────── */}
      <Dialog open={!!bulkResult} onOpenChange={(open) => { if (!open) setBulkResult(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('orgStructure.excel.importResult')}</DialogTitle>
          </DialogHeader>
          {bulkResult && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Stat label={t('orgStructure.excel.totalRows')} value={bulkResult.totalRows} />
                <Stat label={t('orgStructure.excel.failed')} value={bulkResult.failed} highlight={bulkResult.failed > 0} />
                <Stat label={t('orgStructure.excel.departmentsCreated')} value={bulkResult.departmentsCreated} />
                <Stat label={t('orgStructure.excel.departmentsExisting')} value={bulkResult.departmentsExisting} />
                <Stat label={t('orgStructure.excel.areasCreated')} value={bulkResult.areasCreated} />
                <Stat label={t('orgStructure.excel.areasExisting')} value={bulkResult.areasExisting} />
                <Stat label={t('orgStructure.excel.positionsCreated')} value={bulkResult.positionsCreated} />
                <Stat label={t('orgStructure.excel.positionsExisting')} value={bulkResult.positionsExisting} />
              </div>

              {bulkResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-medium text-destructive flex items-center gap-1.5">
                    <AlertCircle className="size-4" /> {t('orgStructure.excel.rowErrors')}
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {bulkResult.errors.map((err, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <span className="font-medium">{t('orgStructure.excel.row', { number: err.row })}</span>
                        {err.department && <span className="text-muted-foreground"> · {err.department}</span>}
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

      {/* ── Typology dialogs ──────────────────────────────────── */}
      <TypologyDialogs hook={typologiesHook} />
    </main>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight && value > 0 ? 'font-semibold text-destructive' : 'font-semibold'}>{value}</span>
    </div>
  )
}
