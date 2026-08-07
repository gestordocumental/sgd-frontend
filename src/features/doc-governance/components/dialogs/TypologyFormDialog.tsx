import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
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
import {
  getTypologyMismatchErrors,
  applyFieldErrors,
} from '@/features/doc-governance/hooks/use-typologies';
import { type TypologiesHook } from './typology-dialog-shared';
import { FilePicker } from './FilePicker';
import { OrgStructureSelectors } from './OrgStructureSelectors';

export function TypologyFormDialog({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation();
  const {
    form,
    createOpen,
    setCreateOpen,
    editTypology,
    setEditTypology,
    createFile,
    setCreateFile,
    editFile,
    setEditFile,
    createMutation,
    editMutation,
    newVersionMutation,
    uploadMutation,
    previewExtractMutation,
    extracting,
  } = hook;

  const isEditing = !!editTypology;
  const open = createOpen || isEditing;
  const currentVersion = editTypology?.datosDeclarados.version ?? null;
  const pending =
    createMutation.isPending ||
    editMutation.isPending ||
    newVersionMutation.isPending ||
    uploadMutation.isPending;

  const handleSubmit = form.handleSubmit((values) => {
    if (isEditing && editFile) {
      const { nombre: en, codigo: ec, version: ev } = editTypology!.datosDeclarados;
      const errors = getTypologyMismatchErrors(
        values,
        { nombre: en ?? undefined, codigo: ec ?? undefined, version: ev ?? undefined },
        t,
      );
      applyFieldErrors(form, errors);
      if (Object.keys(errors).length > 0) return;
      newVersionMutation.mutate({ dto: values, file: editFile });
    } else if (isEditing) {
      editMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  });

  const closeForm = () => {
    setCreateOpen(false);
    setEditTypology(null);
    setCreateFile(null);
    setEditFile(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closeForm();
      }}
    >
      <DialogContent className="w-full max-w-[95vw] sm:max-w-xl flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditing ? t('docGovernance.form.editTitle') : t('docGovernance.form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 pt-2 overflow-y-auto min-h-0 pr-1"
        >
          <OrgStructureSelectors hook={hook} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              id="typo-nombre"
              label={t('docGovernance.form.nameLabel')}
              error={form.formState.errors.nombre?.message}
            >
              <Input
                id="typo-nombre"
                placeholder={t('docGovernance.form.namePlaceholder')}
                {...form.register('nombre')}
              />
            </FormField>
            <FormField
              id="typo-codigo"
              label={t('docGovernance.form.codeLabel')}
              error={form.formState.errors.codigo?.message}
            >
              <Input
                id="typo-codigo"
                placeholder={t('docGovernance.form.codePlaceholder')}
                {...form.register('codigo')}
                disabled={isEditing}
              />
            </FormField>
          </div>

          <FormField
            id="typo-version"
            label={t('docGovernance.form.versionLabel')}
            error={form.formState.errors.version?.message}
          >
            <Input
              id="typo-version"
              placeholder={t('docGovernance.form.versionPlaceholder')}
              {...form.register('version')}
            />
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="typo-review-cycle-enabled"
              {...form.register('reviewCycleEnabled')}
              className="size-4 rounded border-input"
            />
            <label htmlFor="typo-review-cycle-enabled" className="text-sm">
              {t('docGovernance.form.reviewCycleEnabledLabel')}
            </label>
          </div>

          {!isEditing ? (
            <FormField
              id="typo-file"
              label={t('docGovernance.form.documentLabel')}
              description={
                extracting
                  ? undefined
                  : createFile
                    ? t('docGovernance.form.documentHintAfterSelect')
                    : t('docGovernance.form.documentHintBeforeSelect')
              }
            >
              <>
                <FilePicker
                  file={createFile}
                  onChange={(f) => {
                    setCreateFile(f);
                    previewExtractMutation.mutate(f);
                  }}
                  onClear={() => {
                    setCreateFile(null);
                    previewExtractMutation.reset();
                  }}
                />
                {extracting && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    {t('docGovernance.form.extracting')}
                  </p>
                )}
              </>
            </FormField>
          ) : (
            <FormField
              id="typo-file-edit"
              label={t('docGovernance.form.newDocumentLabel')}
              description={
                extracting
                  ? undefined
                  : editFile
                    ? t('docGovernance.form.editDocumentHintAfterSelect', {
                        version: currentVersion ?? '—',
                      })
                    : t('docGovernance.form.editDocumentHintBeforeSelect')
              }
            >
              <>
                <FilePicker
                  file={editFile}
                  onChange={(f) => {
                    setEditFile(f);
                    previewExtractMutation.mutate(f);
                  }}
                  onClear={() => {
                    setEditFile(null);
                    previewExtractMutation.reset();
                    const existing = editTypology!.datosDeclarados;
                    form.clearErrors(['nombre', 'codigo', 'version']);
                    form.setValue('nombre', existing.nombre ?? '', { shouldValidate: true });
                    form.setValue('codigo', existing.codigo ?? '', { shouldValidate: true });
                    form.setValue('version', existing.version ?? '', { shouldValidate: true });
                  }}
                />
                {extracting && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    {t('docGovernance.form.extracting')}
                  </p>
                )}
              </>
            </FormField>
          )}

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <DialogFooter className="pt-2 shrink-0">
            <Button type="button" variant="outline" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending || extracting || !form.formState.isValid}>
              {newVersionMutation.isPending
                ? t('docGovernance.form.creatingNewVersion')
                : pending
                  ? t('docGovernance.form.saving')
                  : extracting
                    ? t('docGovernance.form.extractingShort')
                    : isEditing && editFile
                      ? t('docGovernance.form.createNewVersion')
                      : isEditing
                        ? t('common.saveChanges')
                        : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
