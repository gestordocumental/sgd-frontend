import type { ApiUser } from '@/lib/api/users'
import i18n from '@/i18n'

export function initials(name: string | undefined | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function isDeleted(user: ApiUser): boolean {
  return !!user.deletedAt
}

export function formatDate(dateStr: string): string {
  const locale = i18n.language.startsWith('es') ? 'es-CO' : 'en-US'
  return new Date(dateStr).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
