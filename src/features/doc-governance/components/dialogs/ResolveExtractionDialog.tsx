import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import type { ResolveAction, ResolveExtractionDto } from '@/lib/api/typologies';
import { type TypologiesHook } from './typology-dialog-shared';

const ACTION_OPTIONS: ResolveAction[] = ['KEEP_DECLARED', 'ADOPT_EXTRACTED', 'MANUAL_OVERRIDE'];

export function ResolveExtractionDialog({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation();
  const { resolveTypology, setResolveTypology, resolveExtractionForm, resolveExtractionMutation } =
    hook;

  const typo = resolveTypology;
  const open = !!typo;
  const pending = resolveExtractionMutation.isPending;
  const isPendingConfirmation = typo?.documento.extractionStatus === 'PENDING_CONFIRMATION';
  const discrepancies = typo?.metadataExtraida.discrepancias ?? [];
  const action = resolveExtractionForm.watch('action');

  const close = () => {
    setResolveTypology(null);
    resolveExtractionForm.reset();
  };

  const handleSubmit = resolveExtractionForm.handleSubmit((values) => {
    const dto: ResolveExtractionDto =
      values.action === 'MANUAL_OVERRIDE'
        ? {
            action: values.action,
            nombre: values.nombre,
            codigo: values.codigo,
            version: values.version,
          }
        : { action: values.action };
    resolveExtractionMutation.mutate(dto);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('docGovernance.resolve.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            {isPendingConfirmation
              ? t('docGovernance.resolve.pendingIntro')
              : t('docGovernance.resolve.discrepancyIntro')}
          </p>

          {discrepancies.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
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

          {isPendingConfirmation && (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">
                  {t('docGovernance.upload.nameLabel')}:{' '}
                </span>
                {typo?.metadataExtraida.nombre ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('docGovernance.upload.codeLabel')}:{' '}
                </span>
                {typo?.metadataExtraida.codigo ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('docGovernance.form.versionLabel')}:{' '}
                </span>
                {typo?.metadataExtraida.version ?? '—'}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-sm font-medium">{t('docGovernance.resolve.actionLabel')}</span>
            <div
              className="grid gap-2"
              role="radiogroup"
              aria-label={t('docGovernance.resolve.actionLabel')}
            >
              {ACTION_OPTIONS.filter(
                (opt) => !(isPendingConfirmation && opt === 'KEEP_DECLARED'),
              ).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={action === opt}
                  onClick={() =>
                    resolveExtractionForm.setValue('action', opt, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    action === opt
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-input hover:bg-muted',
                  )}
                >
                  <div className="font-medium">
                    {t(`docGovernance.resolve.actions.${opt}.label`)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(`docGovernance.resolve.actions.${opt}.description`)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {action === 'MANUAL_OVERRIDE' && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <FormField
                id="resolve-nombre"
                label={t('docGovernance.form.nameLabel')}
                error={resolveExtractionForm.formState.errors.nombre?.message}
              >
                <Input
                  id="resolve-nombre"
                  maxLength={255}
                  {...resolveExtractionForm.register('nombre')}
                />
              </FormField>
              <FormField
                id="resolve-codigo"
                label={t('docGovernance.form.codeLabel')}
                error={resolveExtractionForm.formState.errors.codigo?.message}
              >
                <Input
                  id="resolve-codigo"
                  maxLength={100}
                  {...resolveExtractionForm.register('codigo')}
                />
              </FormField>
              <FormField
                id="resolve-version"
                label={t('docGovernance.form.versionLabel')}
                error={resolveExtractionForm.formState.errors.version?.message}
              >
                <Input
                  id="resolve-version"
                  maxLength={50}
                  {...resolveExtractionForm.register('version')}
                />
              </FormField>
            </div>
          )}

          {resolveExtractionForm.formState.errors.root && (
            <p className="text-sm text-destructive">
              {resolveExtractionForm.formState.errors.root.message}
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t('docGovernance.resolve.submitting') : t('docGovernance.resolve.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
