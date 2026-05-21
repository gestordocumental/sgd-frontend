import { type TypologiesHook } from './dialogs/typology-dialog-shared'
import { TypologyFormDialog } from './dialogs/TypologyFormDialog'
import { UploadDocumentDialog } from './dialogs/UploadDocumentDialog'
import { DeleteDialog } from './dialogs/DeleteDialog'
import { HistoryDialog } from './dialogs/HistoryDialog'

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
