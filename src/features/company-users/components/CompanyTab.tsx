import { Users, Shield, UserCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { InfoRow } from '@/components/ui/info-row'
import { formatDate } from '@/lib/formatters'
import type { ApiCompany } from '@/lib/api/companies'

interface CompanyTabProps {
  company: ApiCompany | undefined
  activeUsersCount: number
  totalUsersCount: number
  rolesCount: number
}

export function CompanyTab({ company, activeUsersCount, totalUsersCount, rolesCount }: CompanyTabProps) {
  const { t } = useTranslation()

  if (!company) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        {t('companyInfo.loading')}
      </div>
    )
  }

  return (
    <main className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t('companyInfo.activeUsers')} value={activeUsersCount} icon={<Users className="size-5 text-muted-foreground" />} />
        <StatCard title={t('companyInfo.configuredRoles')} value={rolesCount} icon={<Shield className="size-5 text-muted-foreground" />} />
        <StatCard title={t('companyInfo.totalUsers')} value={totalUsersCount} icon={<UserCheck className="size-5 text-muted-foreground" />} />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">{t('companyInfo.title')}</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <InfoRow label={t('companyInfo.nameLabel')} value={company.name} />
          <InfoRow label={t('companyInfo.nitLabel')} value={company.nit ?? '—'} mono />
          <InfoRow label={t('companyInfo.addressLabel')} value={company.address ?? '—'} />
          <InfoRow
            label={t('companyInfo.statusLabel')}
            value={
              company.status === 'active' ? (
                <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                  {t('common.active')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {t('common.inactive')}
                </Badge>
              )
            }
          />
          <InfoRow label={t('companyInfo.memberSince')} value={formatDate(company.createdAt)} />
        </div>
      </div>
    </main>
  )
}
