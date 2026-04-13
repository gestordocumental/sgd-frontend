import { Pencil, Trash2, Plus, Upload, Download, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react'
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

function downloadTemplate() {
  const headers = [
    'Departamento',
    'Descripción Departamento',
    'Área',
    'Descripción Área',
    'Cargo',
    'Descripción Cargo',
  ]
  const rows = [
    ['Recursos Humanos', 'Gestión del talento humano', 'Selección', 'Reclutamiento y selección', 'Analista de Selección', 'Gestiona procesos de selección'],
    ['Recursos Humanos', '', 'Nómina', 'Liquidación de nómina', 'Auxiliar de Nómina', ''],
    ['Tecnología', 'Área de sistemas e infraestructura', 'Desarrollo', 'Desarrollo de software', 'Desarrollador Frontend', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 24 }, { wch: 30 }, { wch: 20 }, { wch: 28 }, { wch: 26 }, { wch: 30 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Estructura')
  XLSX.writeFile(wb, 'plantilla-estructura-organizacional.xlsx')
}

type OrgStructureHook = ReturnType<typeof useOrgStructure>

interface OrgStructureTabProps {
  hook: OrgStructureHook
  canWrite?: boolean
}

const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

export function OrgStructureTab({ hook, canWrite = false }: OrgStructureTabProps) {
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
          toast.success(`Importación completada: ${result.departmentsCreated} departamentos, ${result.areasCreated} áreas, ${result.positionsCreated} cargos creados.`)
        } else {
          toast.warning(`Importación con errores: ${result.failed} filas fallidas de ${result.totalRows}.`)
        }
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al importar el archivo'
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
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bulkImportMutation.isPending}
                      >
                        {bulkImportMutation.isPending ? (
                          <Upload className="size-4 animate-pulse" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        {bulkImportMutation.isPending ? 'Importando...' : 'Excel'}
                        <ChevronDown className="size-3.5 ml-0.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={downloadTemplate}>
                        <Download className="size-4" />
                        Descargar plantilla
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-4" />
                        Importar archivo
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
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditDept(d)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => setDeleteDept(d)}>
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
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditArea(a)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => setDeleteArea(a)}>
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
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditCargo(c)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => setDeleteCargo(c)}>
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
      </Tabs>

      {/* ── Bulk import result dialog ──────────────────────────── */}
      <Dialog open={!!bulkResult} onOpenChange={(open) => { if (!open) setBulkResult(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultado de importación</DialogTitle>
          </DialogHeader>
          {bulkResult && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Total filas" value={bulkResult.totalRows} />
                <Stat label="Fallidas" value={bulkResult.failed} highlight={bulkResult.failed > 0} />
                <Stat label="Departamentos creados" value={bulkResult.departmentsCreated} />
                <Stat label="Departamentos existentes" value={bulkResult.departmentsExisting} />
                <Stat label="Áreas creadas" value={bulkResult.areasCreated} />
                <Stat label="Áreas existentes" value={bulkResult.areasExisting} />
                <Stat label="Cargos creados" value={bulkResult.positionsCreated} />
                <Stat label="Cargos existentes" value={bulkResult.positionsExisting} />
              </div>

              {bulkResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-medium text-destructive flex items-center gap-1.5">
                    <AlertCircle className="size-4" /> Errores por fila
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {bulkResult.errors.map((err, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <span className="font-medium">Fila {err.row}</span>
                        {err.department && <span className="text-muted-foreground"> · {err.department}</span>}
                        <p className="text-destructive mt-0.5">{err.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bulkResult.failed === 0 && (
                <p className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle className="size-4" /> Importación exitosa sin errores
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
