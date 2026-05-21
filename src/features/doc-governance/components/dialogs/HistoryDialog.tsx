import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type TypologiesHook, typologyStatusClass, formatDate } from './typology-dialog-shared'

export function HistoryDialog({ hook }: { hook: TypologiesHook }) {
  const { t, i18n } = useTranslation()
  const { historyTypology, setHistoryTypology, historyItems, historyLoading } = hook
  const codigo = historyTypology?.datosDeclarados.codigo

  return (
    <Dialog
      open={!!historyTypology}
      onOpenChange={(o) => { if (!o) setHistoryTypology(null) }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {t('docGovernance.history.title')}{' '}
            <span className="font-mono text-primary">{codigo}</span>
          </DialogTitle>
        </DialogHeader>

        {historyLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> {t('docGovernance.history.loading')}
          </div>
        ) : historyItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('docGovernance.history.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('docGovernance.table.name')}</TableHead>
                  <TableHead>{t('docGovernance.table.code')}</TableHead>
                  <TableHead>{t('docGovernance.table.version')}</TableHead>
                  <TableHead>{t('docGovernance.table.department')}</TableHead>
                  <TableHead>{t('docGovernance.table.areaPosition')}</TableHead>
                  <TableHead>{t('docGovernance.table.status')}</TableHead>
                  <TableHead>{t('common.created')}</TableHead>
                  <TableHead>{t('common.updated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems.map((item) => (
                  <TableRow key={item.id} className={item.deletedAt ? 'opacity-50' : undefined}>
                    <TableCell className="font-medium">
                      {item.datosDeclarados.nombre ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.datosDeclarados.codigo ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.datosDeclarados.version ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.estructuraOrg.departamentoNombre}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[item.estructuraOrg.areaNombre, item.estructuraOrg.cargoNombre]
                        .filter(Boolean)
                        .join(' / ') || '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typologyStatusClass[item.typologyStatus]}`}>
                        {t(`docGovernance.typologyStatus.${item.typologyStatus}`)}
                        {item.deletedAt && ` ${t('docGovernance.history.deletedSuffix')}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(item.createdAt, i18n.language)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(item.updatedAt, i18n.language)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => setHistoryTypology(null)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
