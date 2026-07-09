import { useTranslation } from 'react-i18next';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { type TypologiesHook } from './typology-dialog-shared';

export function ResolveExtractionDialog({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation();
  const {
    resolveTypology,
    setResolveTypology,
    resolveExtractionForm,
    resolveExtractionMutation,
    openEdit,
  } = hook;

  const typo = resolveTypology;
  const open = !!typo;
  const pending = resolveExtractionMutation.isPending;
  const discrepancies = typo?.metadataExtraida.discrepancias ?? [];

  // Blocked while the mutation is in flight — otherwise a late onSuccess from
  // this resolution would call setResolveTypology(null) again after the user
  // has already reopened the dialog for a different typology, closing it out
  // from under them.
  const close = () => {
    if (pending) return;
    setResolveTypology(null);
    resolveExtractionForm.reset({});
  };

  // The declared data can only ever come from what's actually in the uploaded
  // document — the backend rejects any resolution that would leave the
  // typology declaring data that doesn't match the document's real content,
  // since a later workflow re-check of that same document would always fail.
  // So there are only two ways forward: adopt what was extracted, or leave to
  // upload a document whose content matches what should be declared.
  const handleAdoptExtracted = () => {
    resolveExtractionMutation.mutate({ action: 'ADOPT_EXTRACTED' });
  };

  const handleUploadCorrected = () => {
    if (!typo) return;
    setResolveTypology(null);
    openEdit(typo);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="w-full max-w-[95vw] sm:max-w-xl flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('docGovernance.resolve.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 overflow-y-auto min-h-0 pr-1">
          <p className="text-sm text-muted-foreground">{t('docGovernance.resolve.intro')}</p>

          {discrepancies.length > 0 && (
            <div className="rounded-md border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">
                      {t('docGovernance.resolve.fieldColumn')}
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      {t('docGovernance.resolve.declaredColumn')}
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      {t('docGovernance.resolve.extractedColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {discrepancies.map((d) => (
                    <tr key={d.campo} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">
                        {t(`docGovernance.resolve.fieldNames.${d.campo}`, d.campo)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{d.valorDeclarado || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{d.valorExtraido || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('docGovernance.resolve.extractedDataLabel')}
            </p>
            <div>
              <span className="text-muted-foreground">{t('docGovernance.upload.nameLabel')}: </span>
              {typo?.metadataExtraida.nombre ?? '—'}
            </div>
            <div>
              <span className="text-muted-foreground">{t('docGovernance.upload.codeLabel')}: </span>
              {typo?.metadataExtraida.codigo ?? '—'}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t('docGovernance.form.versionLabel')}:{' '}
              </span>
              {typo?.metadataExtraida.version ?? '—'}
            </div>
          </div>

          {resolveExtractionForm.formState.errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {resolveExtractionForm.formState.errors.root.message}
            </p>
          )}

          <DialogFooter className="pt-2 flex-col sm:flex-col gap-2">
            <Button
              type="button"
              className="w-full"
              disabled={pending}
              onClick={handleAdoptExtracted}
            >
              {pending
                ? t('docGovernance.resolve.submitting')
                : t('docGovernance.resolve.adoptExtracted')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={handleUploadCorrected}
            >
              <FileUp className="size-4" />
              {t('docGovernance.resolve.uploadCorrected')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={close}
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
