import { describe, it, expect } from 'vitest';
import { structureSchema } from '../use-org-structure';

// structureSchema: name = requiredString() (trimmed, min 1), description = optionalString

describe('structureSchema', () => {
  it('accepts a name with an optional description', () => {
    expect(
      structureSchema.safeParse({ name: 'Recursos Humanos', description: 'Gestión del talento' })
        .success,
    ).toBe(true);
  });

  it('accepts a name without description', () => {
    expect(structureSchema.safeParse({ name: 'Tecnología' }).success).toBe(true);
  });

  it('rejects an empty name (min 1)', () => {
    const r = structureSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('name');
  });

  it('rejects a whitespace-only name (requiredString trims)', () => {
    expect(structureSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects a missing name', () => {
    expect(structureSchema.safeParse({}).success).toBe(false);
  });

  it('accepts an empty description string (description is optional)', () => {
    expect(structureSchema.safeParse({ name: 'Finanzas', description: '' }).success).toBe(true);
  });

  it('accepts long valid names', () => {
    expect(structureSchema.safeParse({ name: 'A'.repeat(100) }).success).toBe(true);
  });
});
