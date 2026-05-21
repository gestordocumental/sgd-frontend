import { useTranslation } from 'react-i18next'
import {
  MoreHorizontal,
  Trash2,
  UserPlus,
  Pencil as PencilIcon,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type ApiCompany } from '@/lib/api/companies'

interface CompanyActionsProps {
  company: ApiCompany
  onCreateUser: () => void
  onEdit: () => void
  onToggleStatus: () => void
  onDelete: () => void
}

export function CompanyActions({
  company,
  onCreateUser,
  onEdit,
  onToggleStatus,
  onDelete,
}: CompanyActionsProps) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('companies.actions.openCompanyMenu', { name: company.name })}
        className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCreateUser}>
          <UserPlus className="size-4" /> {t('companies.actions.createUser')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon className="size-4" /> {t('companies.actions.editCompany')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleStatus}>
          {company.status === 'active' ? (
            <>
              <XCircle className="size-4" /> {t('companies.actions.deactivateCompany')}
            </>
          ) : (
            <>
              <CheckCircle className="size-4" /> {t('companies.actions.activateCompany')}
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" /> {t('companies.actions.deleteCompany')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
