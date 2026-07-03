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
    if (existingVersion && values.version) {
      if (!isExactlyOneIncrement(values.version, existingVersion)) {
        uploadDocForm.setError('version', {
          message: t('docGovernance.upload.versionIncrementError', { version: existingVersion }),
        });
        return;
      }
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('docGovernance.upload.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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

          <DialogFooter className="pt-2">
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
