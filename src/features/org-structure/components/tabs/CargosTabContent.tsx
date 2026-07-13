import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import type { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure';
import { PAGE_SIZE, Pager, SearchInput, EmptyState, selectClass } from '../org-structure-shared';

type OrgStructureHook = ReturnType<typeof useOrgStructure>;

interface CargosTabContentProps {
  hook: OrgStructureHook;
  canWrite?: boolean;
}

export function CargosTabContent({ hook, canWrite = false }: CargosTabContentProps) {
  const { t } = useTranslation();
  const {
    departamentos,
    areas,
    cargos,
    cargosLoading,
    deptCargos,
    deptCargosLoading,
    selectedDeptId,
    handleSelectDept,
    selectedAreaId,
    setSelectedAreaId,
    openCreateCargo,
    openEditCargo,
    setDeleteCargo,
    openCreateDeptCargo,
    openEditDeptCargo,
    setDeleteDeptCargo,
  } = hook;

  const [cargoSearch, setCargoSearch] = useState('');
  const [cargoPage, setCargoPage] = useState(1);

  const activeCargos = selectedAreaId ? cargos : deptCargos;
  const filteredCargos = activeCargos.filter(
    (c) => !cargoSearch || c.name.toLowerCase().includes(cargoSearch.toLowerCase()),
  );
  const cargoTotalPages = Math.max(1, Math.ceil(filteredCargos.length / PAGE_SIZE));
  const cargoSafePage = Math.min(cargoPage, cargoTotalPages);
  const paginatedCargos = filteredCargos.slice(
    (cargoSafePage - 1) * PAGE_SIZE,
    cargoSafePage * PAGE_SIZE,
  );

  return (
    <TabsContent value="cargos" className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="cargos-departamento" className="text-sm font-medium shrink-0">
          {t('orgStructure.departamento')}:
        </label>
        <select
          id="cargos-departamento"
          className={selectClass}
          value={selectedDeptId}
          onChange={(e) => {
            handleSelectDept(e.target.value);
            setCargoPage(1);
          }}
        >
          <option value="">{t('orgStructure.selectDepartamento')}</option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {selectedDeptId && (
          <>
            <label htmlFor="cargos-area" className="text-sm font-medium shrink-0">
              {t('orgStructure.area')}:
            </label>
            <select
              id="cargos-area"
              className={selectClass}
              value={selectedAreaId}
              onChange={(e) => {
                setSelectedAreaId(e.target.value);
                setCargoPage(1);
              }}
            >
              <option value="">{t('orgStructure.noArea')}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </>
        )}

        {selectedDeptId && (
          <SearchInput
            value={cargoSearch}
            onChange={(v) => {
              setCargoSearch(v);
              setCargoPage(1);
            }}
            placeholder={t('common.search')}
          />
        )}

        {selectedDeptId && !selectedAreaId && canWrite && (
          <Button size="sm" onClick={openCreateDeptCargo}>
            <Plus className="size-4" />
            {t('orgStructure.newCargo')}
          </Button>
        )}
        {selectedDeptId && selectedAreaId && canWrite && (
          <Button size="sm" onClick={openCreateCargo}>
            <Plus className="size-4" />
            {t('orgStructure.newCargo')}
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {!selectedDeptId ? (
          <EmptyState message={t('orgStructure.selectDepartamentoFirst')} />
        ) : (selectedAreaId ? cargosLoading : deptCargosLoading) ? (
          <EmptyState message={t('common.loading')} />
        ) : filteredCargos.length === 0 ? (
          <EmptyState
            message={cargoSearch ? t('common.noResults') : t('orgStructure.emptyCargos')}
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
                {paginatedCargos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.description ?? '—'}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {selectedAreaId ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title={t('common.edit')}
                                aria-label={t('common.edit')}
                                onClick={() => openEditCargo(c)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                                onClick={() => setDeleteCargo(c)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title={t('common.edit')}
                                aria-label={t('common.edit')}
                                onClick={() => openEditDeptCargo(c)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                                onClick={() => setDeleteDeptCargo(c)}
                              >
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
              <Pager
                page={cargoSafePage}
                totalPages={cargoTotalPages}
                total={filteredCargos.length}
                onChange={(newPage) => setCargoPage(newPage)}
              />
            )}
          </>
        )}
      </div>
    </TabsContent>
  );
}
