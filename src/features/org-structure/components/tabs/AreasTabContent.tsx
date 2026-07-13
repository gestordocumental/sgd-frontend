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

interface AreasTabContentProps {
  hook: OrgStructureHook;
  canWrite?: boolean;
}

export function AreasTabContent({ hook, canWrite = false }: AreasTabContentProps) {
  const { t } = useTranslation();
  const {
    departamentos,
    areas,
    areasLoading,
    selectedDeptId,
    handleSelectDept,
    openCreateArea,
    openEditArea,
    setDeleteArea,
  } = hook;

  const [areaSearch, setAreaSearch] = useState('');
  const [areaPage, setAreaPage] = useState(1);

  const filteredAreas = areas.filter(
    (a) => !areaSearch || a.name.toLowerCase().includes(areaSearch.toLowerCase()),
  );
  const areaTotalPages = Math.max(1, Math.ceil(filteredAreas.length / PAGE_SIZE));
  const areaSafePage = Math.min(areaPage, areaTotalPages);
  const paginatedAreas = filteredAreas.slice(
    (areaSafePage - 1) * PAGE_SIZE,
    areaSafePage * PAGE_SIZE,
  );

  return (
    <TabsContent value="areas" className="mt-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="areas-dept-select" className="text-sm font-medium shrink-0">
          {t('orgStructure.departamento')}:
        </label>
        <select
          id="areas-dept-select"
          className={selectClass}
          value={selectedDeptId}
          onChange={(e) => {
            handleSelectDept(e.target.value);
            setAreaPage(1);
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
          <SearchInput
            value={areaSearch}
            onChange={(v) => {
              setAreaSearch(v);
              setAreaPage(1);
            }}
            placeholder={t('common.search')}
          />
        )}
        {selectedDeptId && canWrite && (
          <Button size="sm" onClick={openCreateArea}>
            <Plus className="size-4" />
            {t('orgStructure.newArea')}
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
                  {canWrite && (
                    <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAreas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {a.description ?? '—'}
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
                            onClick={() => openEditArea(a)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                            onClick={() => setDeleteArea(a)}
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
            {areaTotalPages > 1 && (
              <Pager
                page={areaSafePage}
                totalPages={areaTotalPages}
                total={filteredAreas.length}
                onChange={setAreaPage}
              />
            )}
          </>
        )}
      </div>
    </TabsContent>
  );
}
