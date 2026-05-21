import { describe, it, expect, vi, beforeEach } from 'vitest'

// i18n must be mocked before importing formatters because formatters.ts
// calls i18n.language at module import time via a top-level reference.
vi.mock('@/i18n', () => ({
  default: { language: 'es' },
}))

import { initials, isDeleted, formatDate } from '../formatters'
import type { ApiUser } from '@/lib/api/users'
import i18n from '@/i18n'

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
  } as ApiUser
}

describe('initials', () => {
  it('returns ? for null', () => {
    expect(initials(null)).toBe('?')
  })

  it('returns ? for undefined', () => {
    expect(initials(undefined)).toBe('?')
  })

  it('returns ? for empty string', () => {
    expect(initials('')).toBe('?')
  })

  it('returns a single initial for a one-word name', () => {
    expect(initials('John')).toBe('J')
  })

  it('returns two uppercase initials for a two-word name', () => {
    expect(initials('John Doe')).toBe('JD')
  })

  it('uses only the first two words for names with more than two parts', () => {
    expect(initials('Juan Carlos Pérez')).toBe('JC')
  })

  it('uppercases lowercase names', () => {
    expect(initials('alice wonderland')).toBe('AW')
  })
})

describe('isDeleted', () => {
  it('returns false when deletedAt is null', () => {
    expect(isDeleted(makeUser({ deletedAt: null }))).toBe(false)
  })

  it('returns true when deletedAt is a date string', () => {
    expect(isDeleted(makeUser({ deletedAt: '2024-06-01T00:00:00.000Z' }))).toBe(true)
  })
})

describe('formatDate', () => {
  beforeEach(() => {
    // Default: Spanish
    vi.mocked(i18n).language = 'es'
  })

  it('formats a date string in Spanish locale', () => {
    const result = formatDate('2024-01-15T00:00:00.000Z')
    // Should contain the year
    expect(result).toMatch(/2024/)
  })

  it('formats a date string in English locale when language is en', () => {
    vi.mocked(i18n).language = 'en'
    const result = formatDate('2024-01-15T00:00:00.000Z')
    expect(result).toMatch(/2024/)
    expect(result).toMatch(/Jan/)
  })
})
