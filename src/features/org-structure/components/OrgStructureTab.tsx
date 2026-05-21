import { Pencil, Trash2, Plus, Upload, Download, ChevronDown, CheckCircle, AlertCircle, FileUp, History, Eye, RefreshCw, Copy, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const PAGE_SIZE = 15

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

  const ws = XLSX.utils.aoa_to_sheet([headers])
  ws['!cols'] = colWidths

  const exampleRows = [
    ['Recursos Humanos', 'Gestión del talento humano', 'Selección', 'Reclutamiento y selección', 'Analista de Selección', 'Gestiona procesos de selección'],
    ['Recursos Humanos', '', 'Nómina', 'Liquidación de nómina', 'Auxiliar de Nómina', ''],
    ['Recursos Humanos', '', '', '', 'Director de RR.HH.', 'Cargo nivel departamento — dejar Área en blanco'],
    ['Tecnología', 'Área de sistemas e infraestructura', 'Desarrollo', 'Desarrollo de software', 'Desarrollador Frontend', ''],
    ['Tecnología', '', '', '', 'CTO', 'Cargo nivel departamento — sin área asignada'],
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
  PENDING_CONFIRMATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  CONFIRMED:            'bg-teal-100   text-teal-800   dark:bg-teal-900/30   dark:text-teal-400',
  FAILED:               'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
}

// ── Pager ─────────────────────────────────────────────────────────────────────

function Pager({ page, totalPages, total, onChange }: {
  page: number; totalPages: number; total: number; onChange: (p: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm text-muted-foreground">
      <span>{t('common.resultsCount', { count: total })}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-7" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs">{page} / {totalPages}</span>
        <Button variant="ghost" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ── SearchInput ───────────────────────────────────────────────────────────────

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 w-44 text-sm"
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function OrgStructureTab({ hook, typologiesHook, canWrite = false }: OrgStructureTabProps) {
  const { t } = useTranslation()
  const {
    departamentos, deptLoading,
    areas, areasLoading,
    cargos, cargosLoading,
    deptCargos, deptCargosLoading,
    selectedDeptId, handleSelectDept,
    selectedAreaId, setSelectedAreaId,
    setCreateDeptOpen, openEditDept, setDeleteDept,
    setCreateAreaOpen, openEditArea, setDeleteArea,
    setCreateCargoOpen, openEditCargo, setDeleteCargo,
    setCreateDeptCargoOpen, openEditDeptCargo, setDeleteDeptCargo,
    bulkImportMutation,
  } = hook

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bulkResult, setBulkResult] = useState<BulkStructureResult | null>(null)

  // Per-tab search + page state
  const [deptSearch, setDeptSearch]   = useState('')
  const [deptPage,   setDeptPage]     = useState(1)
  const [areaSearch, setAreaSearch]   = useState('')
  const [areaPage,   setAreaPage]     = useState(1)
  const [cargoSearch, setCargoSearch] = useState('')
  const [cargoPage,   setCargoPage]   = useState(1)
  const [typoSearch,  setTypoSearch]  = useState('')
  const [typoStatus,  setTypoStatus]  = useState<TypologyStatus | 'all'>('all')
  const [typoPage,    setTypoPage]    = useState(1)

  // Filtered + paginated slices
  const filteredDepts = departamentos.filter((d) =>
    !deptSearch || d.name.toLowerCase().includes(deptSearch.toLowerCase())
  )
  const deptTotalPages = Math.max(1, Math.ceil(filteredDepts.length / PAGE_SIZE))
  const deptSafePage   = Math.min(deptPage, deptTotalPages)
  const paginatedDepts = filteredDepts.slice((deptSafePage - 1) * PAGE_SIZE, deptSafePage * PAGE_SIZE)

  const filteredAreas = areas.filter((a) =>
    !areaSearch || a.name.toLowerCase().includes(areaSearch.toLowerCase())
  )
  const areaTotalPages = Math.max(1, Math.ceil(filteredAreas.length / PAGE_SIZE))
  const areaSafePage   = Math.min(areaPage, areaTotalPages)
  const paginatedAreas = filteredAreas.slice((areaSafePage - 1) * PAGE_SIZE, areaSafePage * PAGE_SIZE)

  const activeCargos = selectedAreaId ? cargos : deptCargos
  const filteredCargos = activeCargos.filter((c) =>
    !cargoSearch || c.name.toLowerCase().includes(cargoSearch.toLowerCase())
  )
  const cargoTotalPages = Math.max(1, Math.ceil(filteredCargos.length / PAGE_SIZE))
  const cargoSafePage   = Math.min(cargoPage, cargoTotalPages)
  const paginatedCargos = filteredCargos.slice((cargoSafePage - 1) * PAGE_SIZE, cargoSafePage * PAGE_SIZE)

  const filteredTypos = typologiesHook.typologies.filter((ty: ApiTypology) => {
    const q = typoSearch.toLowerCase()
    const matchesSearch = !q ||
      (ty.datosDeclarados.nombre ?? '').toLowerCase().includes(q) ||
      (ty.datosDeclarados.codigo ?? '').toLowerCase().includes(q)
    const matchesStatus = typoStatus === 'all' || ty.typologyStatus === typoStatus
    return matchesSearch && matchesStatus
  })
  const typoTotalPages = Math.max(1, Math.ceil(filteredTypos.length / PAGE_SIZE))
  const typoSafePage   = Math.min(typoPage, typoTotalPages)
  const paginatedTypos = filteredTypos.slice((typoSafePage - 1) * PAGE_SIZE, typoSafePage * PAGE_SIZE)

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

  const TYPO_STATUS_OPTIONS: { value: TypologyStatus | 'all'; label: string }[] = [
    { value: 'all',       label: t('common.all') },
    { value: 'ACTIVE',    label: t('docGovernance.typologyStatus.ACTIVE') },
    { value: 'INCOMPLETE',label: t('docGovernance.typologyStatus.INCOMPLETE') },
    { value: 'ARCHIVED',  label: t('docGovernance.typologyStatus.ARCHIVED') },
  ]

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
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold shrink-0">{t('orgStructure.departamentos')}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <SearchInput
                  value={deptSearch}
                  onChange={(v) => { setDeptSearch(v); setDeptPage(1) }}
                  placeholder={t('common.search')}
                />
                {canWrite && (
                  <>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
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
                          <Download className="size-4" />{t('orgStructure.excel.downloadTemplate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                          <Upload className="size-4" />{t('orgStructure.excel.importFile')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" onClick={() => { hook.deptForm.reset(); setCreateDeptOpen(true) }}>
                      <Plus className="size-4" />{t('orgStructure.newDepartamento')}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {deptLoading ? (
              <EmptyState message={t('common.loading')} />
            ) : filteredDepts.length === 0 ? (
              <EmptyState message={deptSearch ? t('common.noResults') : t('orgStructure.emptyDepartamentos')} />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      {canWrite && <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDepts.map((d) => (
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
                {deptTotalPages > 1 && (
                  <Pager page={deptSafePage} totalPages={deptTotalPages} total={filteredDepts.length} onChange={setDeptPage} />
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Áreas ─────────────────────────────────────────────── */}
        <TabsContent value="areas" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium shrink-0">{t('orgStructure.departamento')}:</label>
            <select
              className={selectClass}
              value={selectedDeptId}
              onChange={(e) => { handleSelectDept(e.target.value); setAreaPage(1) }}
            >
              <option value="">{t('orgStructure.selectDepartamento')}</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {selectedDeptId && (
              <SearchInput
                value={areaSearch}
                onChange={(v) => { setAreaSearch(v); setAreaPage(1) }}
                placeholder={t('common.search')}
              />
            )}
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
            ) : filteredAreas.length === 0 ? (
              <EmptyState message={areaSearch ? t('common.noResults') : t('orgStructure.emptyAreas')} />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      {canWrite && <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAreas.map((a) => (
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
                {areaTotalPages > 1 && (
                  <Pager page={areaSafePage} totalPages={areaTotalPages} total={filteredAreas.length} onChange={setAreaPage} />
                )}
              </>
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
              onChange={(e) => { handleSelectDept(e.target.value); setCargoPage(1) }}
            >
              <option value="">{t('orgStructure.selectDepartamento')}</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {selectedDeptId && (
              <>
                <label className="text-sm font-medium shrink-0">{t('orgStructure.area')}:</label>
                <select
                  className={selectClass}
                  value={selectedAreaId}
                  onChange={(e) => { setSelectedAreaId(e.target.value); setCargoPage(1) }}
                >
                  <option value="">{t('orgStructure.noArea')}</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </>
            )}

            {selectedDeptId && (
              <SearchInput
                value={cargoSearch}
                onChange={(v) => { setCargoSearch(v); setCargoPage(1) }}
                placeholder={t('common.search')}
              />
            )}

            {selectedDeptId && !selectedAreaId && canWrite && (
              <Button size="sm" onClick={() => { hook.deptCargoForm.reset(); setCreateDeptCargoOpen(true) }}>
                <Plus className="size-4" />{t('orgStructure.newCargo')}
              </Button>
            )}
            {selectedDeptId && selectedAreaId && canWrite && (
              <Button size="sm" onClick={() => { hook.cargoForm.reset(); setCreateCargoOpen(true) }}>
                <Plus className="size-4" />{t('orgStructure.newCargo')}
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {!selectedDeptId ? (
              <EmptyState message={t('orgStructure.selectDepartamentoFirst')} />
            ) : (deptCargosLoading || cargosLoading) ? (
              <EmptyState message={t('common.loading')} />
            ) : filteredCargos.length === 0 ? (
              <EmptyState message={cargoSearch ? t('common.noResults') : t('orgStructure.emptyCargos')} />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      {canWrite && <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCargos.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{c.description ?? '—'}</TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {selectedAreaId ? (
                                <>
                                  <Button variant="ghost" size="icon" className="size-7" title={t('common.edit')} onClick={() => openEditCargo(c)}>
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title={t('common.delete')} onClick={() => setDeleteCargo(c)}>
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" className="size-7" title={t('common.edit')} onClick={() => openEditDeptCargo(c)}>
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title={t('common.delete')} onClick={() => setDeleteDeptCargo(c)}>
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {cargoTotalPages > 1 && (
                  <Pager page={cargoSafePage} totalPages={cargoTotalPages} total={filteredCargos.length} onChange={setCargoPage} />
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Typology ──────────────────────────────────────────── */}
        <TabsContent value="typology" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold shrink-0">{t('docGovernance.table.title')}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <SearchInput
                  value={typoSearch}
                  onChange={(v) => { setTypoSearch(v); setTypoPage(1) }}
                  placeholder={t('common.search')}
                />
                <select
                  value={typoStatus}
                  onChange={(e) => { setTypoStatus(e.target.value as TypologyStatus | 'all'); setTypoPage(1) }}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
                >
                  {TYPO_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
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
              <EmptyState message={(typoSearch || typoStatus !== 'all') ? t('common.noResults') : t('docGovernance.table.empty')} />
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
                        <TableCell className="text-xs">
                          <span className="flex items-center gap-1 min-w-0">
                            <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[90px]" title={typo.id}>
                              {typo.id.slice(0, 8)}…
                            </span>
                            <Button
                              variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0"
                              title={t('audit.detail.copy')}
                              onClick={() => navigator.clipboard.writeText(typo.id)}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {typo.datosDeclarados.codigo && (
                              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" title={t('docGovernance.table.viewHistory')} onClick={() => typologiesHook.setHistoryTypology(typo)}>
                                <History className="size-3.5" />
                              </Button>
                            )}
                            {typo.documento.extractionStatus !== 'NOT_UPLOADED' && (
                              <Button
                                variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground"
                                title={typo.documento.mimeType === 'application/pdf' ? t('docGovernance.table.viewDocument') : t('docGovernance.table.downloadDocument')}
                                disabled={typologiesHook.viewDocumentMutation.isPending}
                                onClick={() => typologiesHook.viewDocumentMutation.mutate(typo.id)}
                              >
                                {typo.documento.mimeType === 'application/pdf' ? <Eye className="size-3.5" /> : <Download className="size-3.5" />}
                              </Button>
                            )}
                            {typo.documento.extractionStatus === 'FAILED' && (
                              <Button
                                variant="ghost" size="icon" className="size-7 text-amber-600 hover:text-amber-700"
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
                                  <Button variant="ghost" size="icon" className="size-7 text-blue-600 hover:text-blue-700" title={t('docGovernance.table.uploadDocument')} onClick={() => typologiesHook.openUploadDoc(typo)}>
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
                {typoTotalPages > 1 && (
                  <Pager page={typoSafePage} totalPages={typoTotalPages} total={filteredTypos.length} onChange={setTypoPage} />
                )}
              </>
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
