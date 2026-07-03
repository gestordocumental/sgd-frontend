import { describe, it, expect } from 'vitest';
import { createWorkflowSchema, approveSchema, rejectSchema } from '../workflow-schemas';

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
