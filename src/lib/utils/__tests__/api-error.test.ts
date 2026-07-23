import { describe, it, expect, vi } from 'vitest';
import { resolveApiError } from '../api-error';

describe('resolveApiError', () => {
  it('translates errorCode with params when a translation exists', () => {
    const t = vi.fn((key: string, params?: Record<string, unknown>) =>
      key === 'errors.AREA_ALREADY_EXISTS' ? `Area "${params?.name}" already exists` : key,
    );

    const result = resolveApiError(
      { response: { data: { errorCode: 'AREA_ALREADY_EXISTS', params: { name: 'Finance' } } } },
      t,
    );

    expect(result).toBe('Area "Finance" already exists');
    expect(t).toHaveBeenCalledWith('errors.AREA_ALREADY_EXISTS', { name: 'Finance' });
  });

  it('falls back to the raw message when errorCode has no translation', () => {
    const t = vi.fn((key: string) => key);

    const result = resolveApiError(
      { response: { data: { errorCode: 'UNKNOWN_CODE', message: 'Raw message' } } },
      t,
    );

    expect(result).toBe('Raw message');
  });

  it('returns the message string when no errorCode is present', () => {
    const t = vi.fn((key: string) => key);

    const result = resolveApiError({ response: { data: { message: 'Plain message' } } }, t);

    expect(result).toBe('Plain message');
  });

  it('joins a non-empty message array with "; "', () => {
    const t = vi.fn((key: string) => key);

    const result = resolveApiError(
      { response: { data: { message: ['Field a is required', 'Field b is invalid'] } } },
      t,
    );

    expect(result).toBe('Field a is required; Field b is invalid');
  });

  it('falls back when the message array is empty', () => {
    const t = vi.fn((key: string) => key);

    const result = resolveApiError(
      { response: { data: { message: [] } } },
      t,
      'Something went wrong',
    );

    expect(result).toBe('Something went wrong');
  });

  it('returns the fallback when there is no message or errorCode', () => {
    const t = vi.fn((key: string) => key);

    const result = resolveApiError({ response: { data: {} } }, t, 'Default error');

    expect(result).toBe('Default error');
  });

  it('returns undefined when there is no message, errorCode, or fallback', () => {
    const t = vi.fn((key: string) => key);

    const result = resolveApiError({ response: { data: {} } }, t);

    expect(result).toBeUndefined();
  });

  it('handles null and undefined errors without throwing', () => {
    const t = vi.fn((key: string) => key);

    expect(resolveApiError(null, t, 'Default error')).toBe('Default error');
    expect(resolveApiError(undefined, t, 'Default error')).toBe('Default error');
  });
});
