import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, X, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { FormField } from '@/components/ui/form-field'
import type { useTypologies } from '@/features/doc-governance/hooks/use-typologies'
import { isExactlyOneIncrement } from '@/features/doc-governance/hooks/use-typologies'
import type { TypologyStatus } from '@/lib/api/typologies'

// CSS-only map — not translatable, stays static
const typologyStatusClass: Record<TypologyStatus, string> = {
  INCOMPLETE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACTIVE:     'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  ARCHIVED:   'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
  DELETED:    'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
}

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: '2-digit' })
}

type TypologiesHook = ReturnType<typeof useTypologies>

const ACCEPTED = '.pdf,.docx,.xlsx'
const MAX_MB   = 20

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

// ── Shared file picker ─────────────────────────────────────────────────────

function FilePicker({
  file,
  onChange,
  onClear,
}: {
  file: File | null
  onChange: (f: File) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    if (f.size > MAX_MB * 1024 * 1024) {
      alert(t('docGovernance.file.sizeError', { maxMb: MAX_MB }))
      return
    }
    onChange(f)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        type="file"
        accept={ACCEPTED}
        aria-label={t('docGovernance.file.selectLabel')}
        className="hidden"
        onChange={handleChange}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm flex-1 min-w-0">
          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            aria-label={t('docGovernance.file.clearLabel')}
            onClick={onClear}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => ref.current?.click()}
        >
          <Upload className="size-4" /> {t('docGovernance.file.selectLabel')}
        </Button>
      )}
      <span className="text-xs text-muted-foreground shrink-0">
        {t('docGovernance.file.hint', { maxMb: MAX_MB })}
      </span>
    </div>
  )
}

// ── Org structure selectors ────────────────────────────────────────────────

function OrgStructureSelectors({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation()
  const {
    form,
    departamentos,
    formAreas,
    formCargos,
    formDeptId,
    formAreaId,
    handleFormDeptChange,
    handleFormAreaChange,
  } = hook
  return (
    <>
      <FormField
        id="typo-dept"
        label={t('docGovernance.form.departmentLabel')}
        error={form.formState.errors.departamentoId?.message}
      >
        <select
          id="typo-dept"
          aria-label={t('docGovernance.form.departmentLabel')}
          className={selectClass}
          value={formDeptId}
          onChange={(e) => handleFormDeptChange(e.target.value)}
        >
          <option value="">{t('docGovernance.form.selectDepartment')}</option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </FormField>

      <FormField id="typo-area" label={t('docGovernance.form.areaLabel')}>
        <select
          id="typo-area"
          aria-label={t('docGovernance.form.areaLabel')}
          className={selectClass}
          value={formAreaId}
          disabled={!formDeptId}
          onChange={(e) => handleFormAreaChange(e.target.value)}
        >
          <option value="">{t('docGovernance.form.noArea')}</option>
          {formAreas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FormField>

      <FormField id="typo-cargo" label={t('docGovernance.form.positionLabel')}>
        <select
          id="typo-cargo"
          aria-label={t('docGovernance.form.positionLabel')}
          className={selectClass}
          disabled={!formAreaId}
          {...form.register('cargoId')}
        >
          <option value="">{t('docGovernance.form.noPosition')}</option>
          {formCargos.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </FormField>
    </>
  )
}

// ── Create / Edit dialog ───────────────────────────────────────────────────

function TypologyFormDialog({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation()
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
  } = hook

  const isEditing      = !!editTypology
  const open           = createOpen || isEditing
  const currentVersion = editTypology?.datosDeclarados.version ?? null
  const pending =
    createMutation.isPending ||
    editMutation.isPending ||
    newVersionMutation.isPending ||
    uploadMutation.isPending

  const handleSubmit = form.handleSubmit((values) => {
    if (isEditing && editFile) {
      if (currentVersion && values.version) {
        if (!isExactlyOneIncrement(values.version, currentVersion)) {
          form.setError('version', {
            message: t('docGovernance.form.versionIncrementError', { version: currentVersion }),
          })
          return
        }
      }
      newVersionMutation.mutate({ dto: values, file: editFile })
    } else if (isEditing) {
      editMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  })

  const closeForm = () => {
    setCreateOpen(false)
    setEditTypology(null)
    setCreateFile(null)
    setEditFile(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeForm() }}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-xl flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditing ? t('docGovernance.form.editTitle') : t('docGovernance.form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2 overflow-y-auto min-h-0 pr-1">
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
                  onChange={(f) => { setCreateFile(f); previewExtractMutation.mutate(f) }}
                  onClear={() => { setCreateFile(null); previewExtractMutation.reset() }}
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
                    ? t('docGovernance.form.editDocumentHintAfterSelect', { version: currentVersion ?? '—' })
                    : t('docGovernance.form.editDocumentHintBeforeSelect')
              }
            >
              <>
                <FilePicker
                  file={editFile}
                  onChange={(f) => { setEditFile(f); previewExtractMutation.mutate(f) }}
                  onClear={() => { setEditFile(null); previewExtractMutation.reset() }}
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
            <p className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
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
  )
}

// ── Upload document dialog ─────────────────────────────────────────────────

function UploadDocumentDialog({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation()
  const {
    uploadDocTypology,
    setUploadDocTypology,
    uploadDocFile,
    setUploadDocFile,
    uploadDocForm,
    uploadDocMutation,
  } = hook

  const typo            = uploadDocTypology
  const open            = !!typo
  const pending         = uploadDocMutation.isPending
  const existingVersion = typo?.datosDeclarados.version ?? null

  const handleSubmit = uploadDocForm.handleSubmit((values) => {
    if (!uploadDocFile) {
      uploadDocForm.setError('root', { message: t('docGovernance.upload.selectFileError') })
      return
    }
    if (existingVersion && values.version) {
      if (!isExactlyOneIncrement(values.version, existingVersion)) {
        uploadDocForm.setError('version', {
          message: t('docGovernance.upload.versionIncrementError', { version: existingVersion }),
        })
        return
      }
    }
    uploadDocMutation.mutate({ values, file: uploadDocFile })
  })

  const close = () => {
    setUploadDocTypology(null)
    setUploadDocFile(null)
    uploadDocForm.reset()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
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
              onChange={setUploadDocFile}
              onClear={() => setUploadDocFile(null)}
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
              {pending ? t('docGovernance.upload.uploading') : t('docGovernance.upload.uploadButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete dialog ──────────────────────────────────────────────────────────

function DeleteDialog({ hook }: { hook: TypologiesHook }) {
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

// ── History dialog ─────────────────────────────────────────────────────────

function HistoryDialog({ hook }: { hook: TypologiesHook }) {
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

// ── Main export ────────────────────────────────────────────────────────────

export function TypologyDialogs({ hook }: { hook: TypologiesHook }) {
  return (
    <>
      <TypologyFormDialog hook={hook} />
      <UploadDocumentDialog hook={hook} />
      <DeleteDialog hook={hook} />
      <HistoryDialog hook={hook} />
    </>
  )
}
