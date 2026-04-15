import { useRef } from 'react'
import { Paperclip, X, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import type { useTypologies } from '@/features/doc-governance/hooks/use-typologies'
import { versionGte } from '@/features/doc-governance/hooks/use-typologies'

type TypologiesHook = ReturnType<typeof useTypologies>

const ACCEPTED = '.pdf,.doc,.docx'
const MAX_MB   = 20

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

// ── Shared file picker button ──────────────────────────────────────────────

function FilePicker({
  file,
  onChange,
  onClear,
}: {
  file: File | null
  onChange: (f: File) => void
  onClear: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    if (f.size > MAX_MB * 1024 * 1024) {
      alert(`El archivo no puede superar ${MAX_MB} MB`)
      return
    }
    onChange(f)
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={ref} type="file" accept={ACCEPTED} className="hidden" onChange={handleChange} />
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm flex-1 min-w-0">
          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={onClear} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
          <Upload className="size-4" /> Seleccionar archivo
        </Button>
      )}
      <span className="text-xs text-muted-foreground shrink-0">PDF, DOC, DOCX · máx {MAX_MB} MB</span>
    </div>
  )
}

// ── Org structure selectors ────────────────────────────────────────────────

function OrgStructureSelectors({ hook }: { hook: TypologiesHook }) {
  const { form, departamentos, formAreas, formCargos,
          formDeptId, formAreaId, handleFormDeptChange, handleFormAreaChange } = hook
  return (
    <>
      <FormField id="typo-dept" label="Departamento" error={form.formState.errors.departamentoId?.message}>
        <select id="typo-dept" className={selectClass} value={formDeptId}
          onChange={(e) => handleFormDeptChange(e.target.value)}>
          <option value="">Seleccione un departamento</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </FormField>

      <FormField id="typo-area" label="Área (opcional)">
        <select id="typo-area" className={selectClass} value={formAreaId}
          disabled={!formDeptId} onChange={(e) => handleFormAreaChange(e.target.value)}>
          <option value="">Sin área</option>
          {formAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </FormField>

      <FormField id="typo-cargo" label="Cargo (opcional)">
        <select id="typo-cargo" className={selectClass} disabled={!formAreaId}
          {...form.register('cargoId')}>
          <option value="">Sin cargo</option>
          {formCargos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FormField>
    </>
  )
}

// ── Create / Edit dialog ───────────────────────────────────────────────────

function TypologyFormDialog({ hook }: { hook: TypologiesHook }) {
  const {
    form, createOpen, setCreateOpen, editTypology, setEditTypology,
    createFile, setCreateFile, createMutation, editMutation, uploadMutation,
    previewExtractMutation, extracting,
  } = hook

  const isEditing = !!editTypology
  const open      = createOpen || isEditing
  const pending   = createMutation.isPending || editMutation.isPending || uploadMutation.isPending

  const handleSubmit = form.handleSubmit((values) => {
    if (isEditing) editMutation.mutate(values)
    else createMutation.mutate(values)
  })

  const closeForm = () => { setCreateOpen(false); setEditTypology(null); setCreateFile(null) }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeForm() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar tipología' : 'Nueva tipología'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <OrgStructureSelectors hook={hook} />

          <div className="grid grid-cols-2 gap-3">
            <FormField id="typo-nombre" label="Nombre" error={form.formState.errors.nombre?.message}>
              <Input id="typo-nombre" placeholder="Ej: Política de Seguridad" {...form.register('nombre')} />
            </FormField>
            <FormField id="typo-codigo" label="Código" error={form.formState.errors.codigo?.message}>
              <Input id="typo-codigo" placeholder="Ej: POL-SEG-001"
                {...form.register('codigo')} disabled={isEditing} />
            </FormField>
          </div>

          <FormField id="typo-version" label="Versión" error={form.formState.errors.version?.message}>
            <Input id="typo-version" placeholder="Ej: v1.0" {...form.register('version')} />
          </FormField>

          {/* File upload — only on create */}
          {!isEditing && (
            <FormField id="typo-file" label="Documento (opcional)"
              description={
                extracting
                  ? undefined
                  : createFile
                    ? 'Revisa los campos extraídos y edítalos si es necesario antes de crear'
                    : 'Al seleccionar el archivo se extraerán automáticamente nombre, código y versión'
              }>
              <>
                <FilePicker
                  file={createFile}
                  onChange={(f) => { setCreateFile(f); previewExtractMutation.mutate(f) }}
                  onClear={() => { setCreateFile(null); previewExtractMutation.reset() }}
                />
                {extracting && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Extrayendo información del documento…
                  </p>
                )}
              </>
            </FormField>
          )}

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button type="submit" disabled={pending || extracting || !form.formState.isValid}>
              {pending ? 'Guardando…' : extracting ? 'Extrayendo…' : isEditing ? 'Guardar cambios' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Upload document dialog ─────────────────────────────────────────────────

function UploadDocumentDialog({ hook }: { hook: TypologiesHook }) {
  const {
    uploadDocTypology, setUploadDocTypology,
    uploadDocFile, setUploadDocFile,
    uploadDocForm, uploadDocMutation,
  } = hook

  const typo    = uploadDocTypology
  const open    = !!typo
  const pending = uploadDocMutation.isPending

  const existingVersion = typo?.datosDeclarados.version ?? null

  const handleSubmit = uploadDocForm.handleSubmit((values) => {
    if (!uploadDocFile) {
      uploadDocForm.setError('root', { message: 'Seleccione un archivo para subir' })
      return
    }

    // Version validation — must be >= existing if one is declared
    if (existingVersion && values.version) {
      if (!versionGte(values.version, existingVersion)) {
        uploadDocForm.setError('version', {
          message: `La versión debe ser igual o mayor a la versión actual (${existingVersion})`,
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
          <DialogTitle>Cargar documento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Código — read only */}
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Código: </span>
            <span className="font-mono font-medium">{typo?.datosDeclarados.codigo ?? '—'}</span>
          </div>

          <FormField id="upload-nombre" label="Nombre"
            error={uploadDocForm.formState.errors.nombre?.message}>
            <Input id="upload-nombre" placeholder="Nombre del documento"
              {...uploadDocForm.register('nombre')} />
          </FormField>

          <FormField id="upload-version" label="Versión"
            error={uploadDocForm.formState.errors.version?.message}
            description={existingVersion ? `Versión actual: ${existingVersion} — ingrese una versión igual o mayor` : undefined}>
            <Input id="upload-version" placeholder="Ej: v1.0"
              {...uploadDocForm.register('version')} />
          </FormField>

          <FormField id="upload-file" label="Archivo">
            <FilePicker
              file={uploadDocFile}
              onChange={setUploadDocFile}
              onClear={() => setUploadDocFile(null)}
            />
          </FormField>

          {uploadDocForm.formState.errors.root && (
            <p className="text-sm text-destructive">{uploadDocForm.formState.errors.root.message}</p>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
            <Button type="submit" disabled={pending || !uploadDocFile}>
              {pending ? 'Subiendo…' : 'Subir documento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete dialog ──────────────────────────────────────────────────────────

function DeleteDialog({ hook }: { hook: TypologiesHook }) {
  const { deleteTypology, setDeleteTypology, deleteMutation } = hook
  return (
    <Dialog open={!!deleteTypology} onOpenChange={(o) => { if (!o) setDeleteTypology(null) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar tipología</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          ¿Está seguro de eliminar la tipología{' '}
          <span className="font-medium text-foreground">
            {deleteTypology?.datosDeclarados.nombre
              ?? deleteTypology?.datosDeclarados.codigo
              ?? deleteTypology?.id}
          </span>
          ? Esta acción no se puede deshacer.
        </p>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => setDeleteTypology(null)}>Cancelar</Button>
          <Button variant="destructive" disabled={deleteMutation.isPending}
            onClick={() => deleteTypology && deleteMutation.mutate(deleteTypology.id)}>
            {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
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
    </>
  )
}
