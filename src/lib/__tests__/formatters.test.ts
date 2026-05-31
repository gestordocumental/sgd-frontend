import { describe, it, expect, vi, beforeEach } from 'vitest';

// i18n must be mocked before importing formatters because formatters.ts
// calls i18n.language at module import time via a top-level reference.
vi.mock('@/i18n', () => ({
  default: { language: 'es' },
}));

import { initials, isDeleted, formatDate, formatBytes, buildMonthlyOrgData } from '../formatters';
import type { ApiUser } from '@/lib/api/users';
import i18n from '@/i18n';

// Minimal ApiUser factory
function makeUser(overrides: Partial<ApiUser> = {}): ApiUser {
  return {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    status: 'ACTIVE',
    isSuperAdmin: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  } as ApiUser;
}

describe('initials', () => {
  it('returns ? for null', () => {
    expect(initials(null)).toBe('?');
  });

  it('returns ? for undefined', () => {
    expect(initials(undefined)).toBe('?');
  });

  it('returns ? for empty string', () => {
    expect(initials('')).toBe('?');
  });

  it('returns a single initial for a one-word name', () => {
    expect(initials('John')).toBe('J');
  });

  it('returns two uppercase initials for a two-word name', () => {
    expect(initials('John Doe')).toBe('JD');
  });

  it('uses only the first two words for names with more than two parts', () => {
    expect(initials('Juan Carlos Pérez')).toBe('JC');
  });

  it('uppercases lowercase names', () => {
    expect(initials('alice wonderland')).toBe('AW');
  });
});

describe('isDeleted', () => {
  it('returns false when deletedAt is null', () => {
    expect(isDeleted(makeUser({ deletedAt: null }))).toBe(false);
  });

  it('returns true when deletedAt is a date string', () => {
    expect(isDeleted(makeUser({ deletedAt: '2024-06-01T00:00:00.000Z' }))).toBe(true);
  });
});

describe('formatBytes', () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes under 1 KB as "N B"', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats bytes in the KB range', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats bytes in the MB range', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('formats bytes in the GB range', () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });
});

describe('buildMonthlyOrgData', () => {
  it('always returns exactly 6 entries', () => {
    expect(buildMonthlyOrgData([])).toHaveLength(6);
  });

  it('each entry has a string label and a number count', () => {
    const result = buildMonthlyOrgData([]);
    for (const entry of result) {
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      expect(typeof entry.count).toBe('number');
    }
  });

  it('counts companies created in the current month in the last slot', () => {
    const now = new Date();
    const thisMonth = now.toISOString();
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString();
    const companies = [
      { createdAt: thisMonth },
      { createdAt: thisMonth },
      { createdAt: lastYear }, // outside the 6-month window
    ] as Array<{ createdAt: string }>;

    const result = buildMonthlyOrgData(companies as never);
    expect(result[5].count).toBe(2);
  });

  it('returns zero counts when no companies exist', () => {
    const result = buildMonthlyOrgData([]);
    expect(result.every((e) => e.count === 0)).toBe(true);
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    // Default: Spanish
    vi.mocked(i18n).language = 'es';
  });

  it('formats a date string in Spanish locale', () => {
    const result = formatDate('2024-01-15T00:00:00.000Z');
    // Should contain the year
    expect(result).toMatch(/2024/);
  });

  it('formats a date string in English locale when language is en', () => {
    vi.mocked(i18n).language = 'en';
    const result = formatDate('2024-01-15T00:00:00.000Z');
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Jan/);
  });
});
