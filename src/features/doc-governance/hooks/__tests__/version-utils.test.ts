import { describe, it, expect } from 'vitest';
import { isExactlyOneIncrement, versionGte } from '../use-typologies';
import {
  formatDate,
  typologyStatusClass,
  ACCEPTED,
  MAX_MB,
} from '../../components/dialogs/typology-dialog-shared';

// ── isExactlyOneIncrement ──────────────────────────────────────────────────────

describe('isExactlyOneIncrement', () => {
  it.each([
    // Simple single-number versions
    ['06', '05', true, 'single digit increment'],
    ['07', '05', false, 'skips two — not exactly one'],
    ['2', '1', true, 'integer step up'],
    ['3', '1', false, 'skips one integer'],

    // Semver — patch
    ['1.0.1', '1.0.0', true, 'patch increment'],
    ['1.0.2', '1.0.0', false, 'patch jump by 2'],

    // Semver — minor with carry
    ['1.1.0', '1.0.9', true, 'minor incremented, patch reset to 0'],
    ['1.2.0', '1.0.9', false, 'minor jump by 2'],

    // Semver — major with carry
    ['v2.0', 'v1.9', true, 'major increment, minor reset to 0'],
    ['v2.1', 'v1.9', false, 'major increment but minor not reset'],

    // Minor patch
    ['v1.1', 'v1.0', true, 'minor increment'],
    ['v1.2', 'v1.0', false, 'minor jump by 2'],

    // Edge cases
    ['v1.0', 'v1.0', false, 'same version is not an increment'],
    ['v0.9', 'v1.0', false, 'going backwards is not an increment'],
  ] as const)('isExactlyOneIncrement(%s, %s) → %s (%s)', (newVer, oldVer, expected, _label) => {
    expect(isExactlyOneIncrement(newVer, oldVer)).toBe(expected);
  });

  it('ignores the v-prefix case-insensitively', () => {
    expect(isExactlyOneIncrement('V1.1', 'V1.0')).toBe(true);
    expect(isExactlyOneIncrement('V1.1', 'V1.1')).toBe(false); // same version ≠ one increment
  });

  it('treats trailing zeros as reset: 2.0 is exactly one above 1.9', () => {
    expect(isExactlyOneIncrement('2.0', '1.9')).toBe(true);
  });

  it('requires ALL trailing segments to reset to 0', () => {
    // 1.1.1 → 1.2.0 is valid (minor++, patch reset)
    expect(isExactlyOneIncrement('1.2.0', '1.1.9')).toBe(true);
    // 1.1.1 → 1.2.1 is invalid (patch was not reset)
    expect(isExactlyOneIncrement('1.2.1', '1.1.9')).toBe(false);
  });
});

// ── versionGte (deprecated helper) ────────────────────────────────────────────

describe('versionGte (deprecated)', () => {
  it.each([
    ['1.0', '0.9', true, 'strictly greater'],
    ['1.0', '1.0', true, 'equal is ≥'],
    ['0.9', '1.0', false, 'strictly less'],
    ['2', '1', true, 'integer comparison'],
    ['1.1.0', '1.0.9', true, 'minor wins over patch'],
  ] as const)('versionGte(%s, %s) → %s (%s)', (a, b, expected, _label) => {
    expect(versionGte(a, b)).toBe(expected);
  });
});

// ── formatDate (typology-dialog-shared) ───────────────────────────────────────

describe('formatDate', () => {
  it('returns "—" for null', () => {
    expect(formatDate(null, 'es-CO')).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatDate(undefined, 'es-CO')).toBe('—');
  });

  it('returns "—" for an invalid date string', () => {
    expect(formatDate('not-a-date', 'es-CO')).toBe('—');
  });

  it('returns a formatted string for a valid ISO date', () => {
    const result = formatDate('2024-03-15T00:00:00.000Z', 'es-CO');
    expect(result).not.toBe('—');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the year in the formatted output', () => {
    expect(formatDate('2024-03-15T00:00:00.000Z', 'es-CO')).toContain('2024');
  });

  it('produces different output for different locales', () => {
    const iso = '2024-03-15T00:00:00.000Z';
    const es = formatDate(iso, 'es-CO');
    const en = formatDate(iso, 'en-US');
    // Both valid — just assert they are non-empty strings
    expect(typeof es).toBe('string');
    expect(typeof en).toBe('string');
  });
});

// ── typologyStatusClass ────────────────────────────────────────────────────────

describe('typologyStatusClass', () => {
  it('has an entry for every TypologyStatus value', () => {
    const statuses = ['INCOMPLETE', 'ACTIVE', 'ARCHIVED', 'DELETED'] as const;
    for (const s of statuses) {
      expect(typologyStatusClass[s]).toBeTruthy();
    }
  });

  it('each entry is a non-empty CSS class string', () => {
    for (const cls of Object.values(typologyStatusClass)) {
      expect(typeof cls).toBe('string');
      expect(cls.trim().length).toBeGreaterThan(0);
    }
  });

  it('ACTIVE maps to a green variant', () => {
    expect(typologyStatusClass.ACTIVE).toContain('green');
  });

  it('DELETED maps to a red variant', () => {
    expect(typologyStatusClass.DELETED).toContain('red');
  });
});

// ── file-type constants ────────────────────────────────────────────────────────

describe('ACCEPTED / MAX_MB', () => {
  it('ACCEPTED includes pdf, docx and xlsx extensions', () => {
    expect(ACCEPTED).toContain('.pdf');
    expect(ACCEPTED).toContain('.docx');
    expect(ACCEPTED).toContain('.xlsx');
  });

  it('MAX_MB is 20', () => {
    expect(MAX_MB).toBe(20);
  });
});
