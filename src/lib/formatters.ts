import type { ApiUser } from '@/lib/api/users'

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
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
