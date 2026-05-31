import type { ApiUser } from '@/lib/api/users';
import type { ApiCompany } from '@/lib/api/companies';
import i18n from '@/i18n';

export function initials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function isDeleted(user: ApiUser): boolean {
  return !!user.deletedAt;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function buildMonthlyOrgData(companies: ApiCompany[]): { label: string; count: number }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleString('default', { month: 'short' }),
      count: companies.filter((c) => {
        const cd = new Date(c.createdAt);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length,
    };
  });
}

export function formatDate(dateStr: string): string {
  const locale = i18n.language.startsWith('es') ? 'es-CO' : 'en-US';
  return new Date(dateStr).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
