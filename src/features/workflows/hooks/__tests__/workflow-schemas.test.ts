import { describe, it, expect } from 'vitest';
import {
  createWorkflowSchema,
  approveSchema,
  rejectSchema,
  namesEqual,
  versionsEqual,
} from '../workflow-schemas';

// ── createWorkflowSchema ───────────────────────────────────────────────────────

describe('createWorkflowSchema', () => {
  it('accepts a title of exactly 3 characters (minimum)', () => {
    expect(createWorkflowSchema.safeParse({ title: 'Abc' }).success).toBe(true);
  });

  it('accepts a title of exactly 500 characters (maximum)', () => {
    expect(createWorkflowSchema.safeParse({ title: 'A'.repeat(500) }).success).toBe(true);
  });

  it('rejects a title shorter than 3 characters', () => {
    const r = createWorkflowSchema.safeParse({ title: 'Ab' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('title');
  });

  it('rejects a title longer than 500 characters', () => {
    expect(createWorkflowSchema.safeParse({ title: 'A'.repeat(501) }).success).toBe(false);
  });

  it('rejects a missing title', () => {
    expect(createWorkflowSchema.safeParse({}).success).toBe(false);
  });

  it('accepts description up to 2000 characters', () => {
    expect(
      createWorkflowSchema.safeParse({
        title: 'Valid Title',
        description: 'D'.repeat(2000),
      }).success,
    ).toBe(true);
  });

  it('rejects description longer than 2000 characters', () => {
    expect(
      createWorkflowSchema.safeParse({
        title: 'Valid Title',
        description: 'D'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('description is optional — omitting it is valid', () => {
    expect(createWorkflowSchema.safeParse({ title: 'Valid Title' }).success).toBe(true);
  });
});

// ── approveSchema ──────────────────────────────────────────────────────────────

describe('approveSchema', () => {
  it('accepts an empty object — observations is optional', () => {
    expect(approveSchema.safeParse({}).success).toBe(true);
  });

  it('accepts observations up to 2000 characters', () => {
    expect(approveSchema.safeParse({ observations: 'O'.repeat(2000) }).success).toBe(true);
  });

  it('rejects observations longer than 2000 characters', () => {
    expect(approveSchema.safeParse({ observations: 'O'.repeat(2001) }).success).toBe(false);
  });

  it('accepts an empty observations string (optional field)', () => {
    expect(approveSchema.safeParse({ observations: '' }).success).toBe(true);
  });
});

// ── rejectSchema ───────────────────────────────────────────────────────────────

describe('rejectSchema', () => {
  it('rejects missing observations', () => {
    expect(rejectSchema.safeParse({}).success).toBe(false);
  });

  it('rejects observations shorter than 10 characters', () => {
    const r = rejectSchema.safeParse({ observations: 'Too short' }); // 9 chars
    expect(r.success).toBe(false);
  });

  it('accepts observations with exactly 10 characters (minimum)', () => {
    expect(rejectSchema.safeParse({ observations: '1234567890' }).success).toBe(true);
  });

  it('accepts observations with exactly 3000 characters (maximum)', () => {
    expect(rejectSchema.safeParse({ observations: 'R'.repeat(3000) }).success).toBe(true);
  });

  it('rejects observations longer than 3000 characters', () => {
    expect(rejectSchema.safeParse({ observations: 'R'.repeat(3001) }).success).toBe(false);
  });

  it('the error message references "Mínimo 10 caracteres" for too-short input', () => {
    const r = rejectSchema.safeParse({ observations: 'short' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues[0].message;
      expect(msg).toContain('10');
    }
  });
});

// ── namesEqual ───────────────────────────────────────────────────────────────

describe('namesEqual', () => {
  // Regresión: el título del Excel F-F-002 V8 viene en Title Case y sin tilde
  // en "Viaticos"; la tipología lo declara en minúsculas con "viáticos".
  it('treats the F-F-002 Excel title and the declared typology name as equal', () => {
    expect(
      namesEqual(
        'Formato para Reembolso/Legalización de Gastos Caja Menor, Anticipos, Viaticos y Transportes',
        'Formato para reembolso/legalización de gastos caja menor, anticipos, viáticos y transportes',
      ),
    ).toBe(true);
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(namesEqual('  Manual   de calidad ', 'Manual de calidad')).toBe(true);
  });

  it('treats different words as not equal', () => {
    expect(namesEqual('Formato de viáticos', 'Formato de anticipos')).toBe(false);
  });

  it('keeps ñ as a distinct letter ("Año" ≠ "Ano")', () => {
    expect(namesEqual('Informe del Año', 'Informe del Ano')).toBe(false);
    expect(namesEqual('INFORME DEL AÑO', 'informe del año')).toBe(true);
  });

  it('keeps ñ distinct even when it arrives decomposed (n + U+0303)', () => {
    expect(namesEqual('Año', 'Año')).toBe(true);
    expect(namesEqual('Año', 'Ano')).toBe(false);
  });

  it('does not normalize punctuation', () => {
    expect(namesEqual('Reembolso/Legalización', 'Reembolso Legalización')).toBe(false);
  });

  it('handles nulls', () => {
    expect(namesEqual(null, null)).toBe(true);
    expect(namesEqual('A', null)).toBe(false);
    expect(namesEqual(null, 'A')).toBe(false);
  });
});

// ── versionsEqual ────────────────────────────────────────────────────────────

describe('versionsEqual', () => {
  it('treats "6" and "06" as the same version', () => {
    expect(versionsEqual('6', '06')).toBe(true);
  });

  it('treats "1.2" and "01.02" as the same version', () => {
    expect(versionsEqual('1.2', '01.02')).toBe(true);
  });

  it('ignores an optional leading "v" prefix', () => {
    expect(versionsEqual('v1', '01')).toBe(true);
  });

  it('treats different version numbers as not equal', () => {
    expect(versionsEqual('6', '7')).toBe(false);
  });

  it('treats "1.2" and "1.20" as different versions (trailing digit is a real segment, not padding)', () => {
    expect(versionsEqual('1.2', '1.20')).toBe(false);
  });

  it('falls back to a plain string comparison for non-numeric version schemes', () => {
    expect(versionsEqual('Rev-A', 'Rev-A')).toBe(true);
    expect(versionsEqual('Rev-A', 'Rev-B')).toBe(false);
  });

  it('trims whitespace before comparing', () => {
    expect(versionsEqual(' 6 ', '06')).toBe(true);
  });

  it('returns false when only one side is null', () => {
    expect(versionsEqual(null, '6')).toBe(false);
    expect(versionsEqual('6', null)).toBe(false);
  });

  it('returns true when both sides are null', () => {
    expect(versionsEqual(null, null)).toBe(true);
  });

  it('does not lose precision on integers beyond Number.MAX_SAFE_INTEGER', () => {
    // A Number round-trip would silently collapse these two distinct values
    // to the same float, wrongly reporting them as the same version.
    expect(versionsEqual('9007199254740992', '9007199254740993')).toBe(false);
  });
});
