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
import { isExactlyOneIncrement } from '@/features/doc-governance/hooks/use-typologies';
import { type TypologiesHook } from './typology-dialog-shared';
import { FilePicker } from './FilePicker';

export function UploadDocumentDialog({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation();
  const {
    uploadDocTypology,
    setUploadDocTypology,
    uploadDocFile,
    setUploadDocFile,
    uploadDocForm,
    uploadDocMutation,
  } = hook;

  const typo = uploadDocTypology;
  const open = !!typo;
  const pending = uploadDocMutation.isPending;
  const existingVersion = typo?.datosDeclarados.version ?? null;

  const handleSubmit = uploadDocForm.handleSubmit((values) => {
    if (!uploadDocFile) {
      uploadDocForm.setError('root', { message: t('docGovernance.upload.selectFileError') });
      return;
    }
    // Mirrors the backend's own rule (typologies.service.ts update()): the
    // version may stay exactly the same — e.g. resolving a discrepancy by
    // uploading a corrected file for the version that's already declared —
    // or move up by exactly one increment. Only reject anything else
    // (a decrement, a multi-step jump, malformed input).
    if (
      existingVersion &&
      values.version &&
      values.version !== existingVersion &&
      !isExactlyOneIncrement(values.version, existingVersion)
    ) {
      uploadDocForm.setError('version', {
        message: t('docGovernance.upload.versionIncrementError', { version: existingVersion }),
      });
      return;
    }
    uploadDocMutation.mutate({ values, file: uploadDocFile });
  });

  const close = () => {
    setUploadDocTypology(null);
    setUploadDocFile(null);
    uploadDocForm.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="w-full max-w-[95vw] sm:max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('docGovernance.upload.title')}</DialogTitle>
        </DialogHeader>

        {/* Same overflow-safe pattern as the sibling dialogs (TypologyFormDialog,
            ResolveExtractionDialog): DialogContent itself has no max-height or
            scroll built in, so without this the modal could grow taller than the
            viewport — no document + a version-mismatch/root error pushing the
            content past the fold — with no way to scroll to the rest of it or
            to the footer buttons. */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 pt-2 overflow-y-auto min-h-0 pr-1"
        >
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t('docGovernance.upload.codeLabel')}: </span>
            <span className="font-mono font-medium">{typo?.datosDeclarados.codigo ?? '—'}</span>
          </div>

          <FormField
            id="upload-nombre"
            label={t('docGovernance.upload.nameLabel')}
            error={uploadDocForm.formState.errors.nombre?.message}
          >
            <Input
              id="upload-nombre"
              placeholder={t('docGovernance.upload.namePlaceholder')}
              {...uploadDocForm.register('nombre')}
            />
          </FormField>

          <FormField
            id="upload-version"
            label={t('docGovernance.upload.versionLabel')}
            error={uploadDocForm.formState.errors.version?.message}
            description={
              existingVersion
                ? t('docGovernance.upload.versionHint', { version: existingVersion })
                : undefined
            }
          >
            <Input
              id="upload-version"
              placeholder={t('docGovernance.form.versionPlaceholder')}
              {...uploadDocForm.register('version')}
            />
          </FormField>

          <FormField id="upload-file" label={t('docGovernance.upload.fileLabel')}>
            <FilePicker
              file={uploadDocFile}
              onChange={(file) => {
                setUploadDocFile(file);
                uploadDocForm.clearErrors('root');
              }}
              onClear={() => {
                setUploadDocFile(null);
                uploadDocForm.clearErrors('root');
              }}
            />
          </FormField>

          {uploadDocForm.formState.errors.root && (
            <p className="text-sm text-destructive">
              {uploadDocForm.formState.errors.root.message}
            </p>
          )}

          <DialogFooter className="pt-2 shrink-0">
            <Button type="button" variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending || !uploadDocFile}>
              {pending
                ? t('docGovernance.upload.uploading')
                : t('docGovernance.upload.uploadButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
