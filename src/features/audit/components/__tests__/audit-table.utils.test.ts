import { describe, it, expect } from 'vitest';
import {
  resolveActorName,
  formatAction,
  formatFieldName,
  resourceTypeColor,
  formatResourceType,
  resolveResourceName,
  formatDate,
  RESOURCE_TYPES,
  CORRELATION_RESOURCE_TYPES,
  ALL_ACTIONS,
  ACTIONS_BY_SERVICE,
  RESOURCE_TYPE_COLORS,
  type TFn,
  type SimpleUser,
} from '../audit-table.utils';

// ── helpers ────────────────────────────────────────────────────────────────────

/** t() that returns the i18n key — used to assert the key is constructed correctly */
const tKey: TFn = (key) => key;

/** t() that returns the defaultValue — mirrors real i18n fallback behavior */
const tDefault: TFn = (key, opts) => (opts?.['defaultValue'] as string | undefined) ?? key;

const users: SimpleUser[] = [
  { id: 'u1', firstName: 'Ana', lastName: 'García', email: 'ana@test.com' },
  { id: 'u2', firstName: null, lastName: null, email: 'bob@test.com' },
  { id: 'u3', firstName: 'Carlos', lastName: null, email: 'carlos@test.com' },
  { id: 'u4', firstName: null, lastName: 'Díaz', email: null },
  { id: 'u5', firstName: null, lastName: null, email: null },
];

// ── resolveActorName ───────────────────────────────────────────────────────────

describe('resolveActorName', () => {
  it('returns "firstName lastName" when both parts exist', () => {
    expect(resolveActorName('u1', users)).toBe('Ana García');
  });

  it('falls back to email when name parts are both null', () => {
    expect(resolveActorName('u2', users)).toBe('bob@test.com');
  });

  it('returns firstName alone when lastName is null', () => {
    expect(resolveActorName('u3', users)).toBe('Carlos');
  });

  it('returns lastName alone when firstName is null', () => {
    expect(resolveActorName('u4', users)).toBe('Díaz');
  });

  it('returns actorId when user has no name and no email', () => {
    expect(resolveActorName('u5', users)).toBe('u5');
  });

  it('returns actorId when user is not in the list', () => {
    expect(resolveActorName('unknown-id', users)).toBe('unknown-id');
  });

  it('handles an empty users array', () => {
    expect(resolveActorName('u1', [])).toBe('u1');
  });
});

// ── formatAction ───────────────────────────────────────────────────────────────

describe('formatAction', () => {
  it('builds the i18n key with audit.actions prefix', () => {
    expect(formatAction('USER_CREATED', tKey)).toBe('audit.actions.USER_CREATED');
  });

  it('uses underscore-to-space replacement as defaultValue fallback', () => {
    expect(formatAction('USER_CREATED', tDefault)).toBe('USER CREATED');
  });

  it('handles multi-word actions', () => {
    expect(formatAction('STEP_APPROVED', tDefault)).toBe('STEP APPROVED');
  });
});

// ── formatFieldName ────────────────────────────────────────────────────────────

describe('formatFieldName', () => {
  it('builds the i18n key with audit.fields prefix', () => {
    expect(formatFieldName('firstName', tKey)).toBe('audit.fields.firstName');
  });

  it('returns the field name as defaultValue when key has no translation', () => {
    expect(formatFieldName('camelCaseField', tDefault)).toBe('camelCaseField');
  });
});

// ── resourceTypeColor ──────────────────────────────────────────────────────────

describe('resourceTypeColor', () => {
  it.each(Object.entries(RESOURCE_TYPE_COLORS))(
    'returns correct Tailwind class for "%s"',
    (type, expectedClass) => {
      expect(resourceTypeColor(type)).toBe(expectedClass);
    },
  );

  it('returns the muted fallback class for an unknown type', () => {
    expect(resourceTypeColor('unknown-type')).toBe('bg-muted text-muted-foreground');
  });

  it('returns fallback for empty string', () => {
    expect(resourceTypeColor('')).toBe('bg-muted text-muted-foreground');
  });
});

// ── formatResourceType ─────────────────────────────────────────────────────────

describe('formatResourceType', () => {
  it('builds the i18n key with audit.resourceTypes prefix', () => {
    expect(formatResourceType('user', tKey)).toBe('audit.resourceTypes.user');
  });

  it('returns the type string as defaultValue for unknown types', () => {
    expect(formatResourceType('alien', tDefault)).toBe('alien');
  });
});

// ── resolveResourceName ────────────────────────────────────────────────────────

describe('resolveResourceName', () => {
  it('returns resourceName directly when present', () => {
    expect(
      resolveResourceName({ resourceId: 'r1', resourceName: 'My Document', metadata: null }),
    ).toBe('My Document');
  });

  it('returns resourceId when resourceName is null and metadata is null', () => {
    expect(resolveResourceName({ resourceId: 'r1', resourceName: null, metadata: null })).toBe(
      'r1',
    );
  });

  it('extracts name from metadata.changes.name.to (UPDATED events)', () => {
    expect(
      resolveResourceName({
        resourceId: 'r1',
        resourceName: null,
        metadata: { changes: { name: { from: 'Old Name', to: 'New Name' } } },
      }),
    ).toBe('New Name');
  });

  it('falls back to changes.name.from when .to is null', () => {
    expect(
      resolveResourceName({
        resourceId: 'r1',
        resourceName: null,
        metadata: { changes: { name: { from: 'Old Name', to: null } } },
      }),
    ).toBe('Old Name');
  });

  it('extracts top-level metadata.name (CREATED events)', () => {
    expect(
      resolveResourceName({
        resourceId: 'r1',
        resourceName: null,
        metadata: { name: 'Created Doc' },
      }),
    ).toBe('Created Doc');
  });

  it('extracts top-level metadata.email when name is absent', () => {
    expect(
      resolveResourceName({
        resourceId: 'r1',
        resourceName: null,
        metadata: { email: 'user@test.com' },
      }),
    ).toBe('user@test.com');
  });

  it('extracts top-level metadata.title when name and email are absent', () => {
    expect(
      resolveResourceName({
        resourceId: 'r1',
        resourceName: null,
        metadata: { title: 'Doc Title' },
      }),
    ).toBe('Doc Title');
  });

  it('falls back to resourceId when metadata has no extractable field', () => {
    expect(
      resolveResourceName({
        resourceId: 'r1',
        resourceName: null,
        metadata: { irrelevantField: 'value' },
      }),
    ).toBe('r1');
  });
});

// ── formatDate ─────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2024-03-15T10:30:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the year in the formatted output', () => {
    expect(formatDate('2024-03-15T10:30:00.000Z')).toContain('2024');
  });
});

// ── constants ──────────────────────────────────────────────────────────────────

describe('RESOURCE_TYPES', () => {
  it('contains exactly 7 resource types', () => {
    expect(RESOURCE_TYPES).toHaveLength(7);
  });

  it('includes all expected types', () => {
    for (const type of [
      'user',
      'company',
      'cargo',
      'area',
      'departamento',
      'typology',
      'workflow',
    ]) {
      expect(RESOURCE_TYPES).toContain(type);
    }
  });
});

describe('CORRELATION_RESOURCE_TYPES', () => {
  it('contains typology and workflow', () => {
    expect(CORRELATION_RESOURCE_TYPES.has('typology')).toBe(true);
    expect(CORRELATION_RESOURCE_TYPES.has('workflow')).toBe(true);
  });

  it('does not include non-correlatable types', () => {
    expect(CORRELATION_RESOURCE_TYPES.has('user')).toBe(false);
    expect(CORRELATION_RESOURCE_TYPES.has('company')).toBe(false);
  });
});

describe('ALL_ACTIONS', () => {
  it('is a sorted, deduplicated union of all service actions', () => {
    const manual = Array.from(new Set(Object.values(ACTIONS_BY_SERVICE).flat())).sort();
    expect(ALL_ACTIONS).toEqual(manual);
  });

  it('contains no duplicates', () => {
    expect(ALL_ACTIONS).toHaveLength(new Set(ALL_ACTIONS).size);
  });

  it('includes actions from every service except audit-service (which has none)', () => {
    expect(ALL_ACTIONS).toContain('USER_CREATED');
    expect(ALL_ACTIONS).toContain('COMPANY_CREATED');
    expect(ALL_ACTIONS).toContain('TYPOLOGY_CREATED');
    expect(ALL_ACTIONS).toContain('WORKFLOW_CREATED');
  });
});
