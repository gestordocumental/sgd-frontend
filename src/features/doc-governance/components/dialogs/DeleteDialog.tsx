import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { type TypologiesHook } from './typology-dialog-shared'

export function DeleteDialog({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation()
  const { deleteTypology, setDeleteTypology, deleteMutation } = hook
  return (
    <Dialog
      open={!!deleteTypology}
      onOpenChange={(o) => { if (!o) setDeleteTypology(null) }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('docGovernance.delete.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('docGovernance.delete.confirmPre')}{' '}
          <span className="font-medium text-foreground">
            {deleteTypology?.datosDeclarados.nombre ??
              deleteTypology?.datosDeclarados.codigo ??
              deleteTypology?.id}
          </span>
          {t('docGovernance.delete.confirmPost')}
        </p>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => setDeleteTypology(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteTypology && deleteMutation.mutate(deleteTypology.id)}
          >
            {deleteMutation.isPending ? t('docGovernance.delete.deleting') : t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
