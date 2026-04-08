import { Pencil, Trash2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure'

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
  } = hook

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
                <Button size="sm" onClick={() => { hook.deptForm.reset(); setCreateDeptOpen(true) }}>
                  <Plus className="size-4" />{t('orgStructure.newDepartamento')}
                </Button>
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
