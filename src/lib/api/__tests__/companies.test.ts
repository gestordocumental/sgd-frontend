import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import * as Sentry from '@sentry/react';
import { apiClient } from '../client';
import { companiesApi, fetchAllCompanies, type ApiCompany } from '../companies';

vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: null, user: null }) },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

const mock = new MockAdapter(apiClient, { onNoMatch: 'throwException' });

function makeCompany(overrides: Partial<ApiCompany> = {}): ApiCompany {
  return {
    id: 'org-1',
    name: 'Acme',
    nit: null,
    address: null,
    phone: null,
    status: 'active',
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
    reviewCycleEnabled: overrides.reviewCycleEnabled ?? true,
  };
}

describe('companiesApi', () => {
  beforeEach(() => {
    mock.reset();
  });

  it('lists companies with cursor/search/status/limit params', async () => {
    const page = { data: [makeCompany()], nextCursor: null, hasMore: false };
    mock.onGet('/org').reply((config) => {
      expect(config.params).toEqual({
        cursor: 'cur-1',
        limit: 10,
        search: 'acme',
        status: 'active',
      });
      return [200, page];
    });

    await expect(
      companiesApi.list({ cursor: 'cur-1', limit: 10, search: 'acme', status: 'active' }),
    ).resolves.toEqual(page);
  });

  it('gets a company by id', async () => {
    const company = makeCompany({ id: 'org-42' });
    mock.onGet('/org/org-42').reply(200, company);

    await expect(companiesApi.getById('org-42')).resolves.toEqual(company);
  });

  it('creates a company with the given dto, including reviewCycleEnabled', async () => {
    const created = makeCompany({ reviewCycleEnabled: false });
    mock.onPost('/org').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ name: 'Acme', reviewCycleEnabled: false });
      return [201, created];
    });

    await expect(companiesApi.create({ name: 'Acme', reviewCycleEnabled: false })).resolves.toEqual(
      created,
    );
  });

  it('updates a company by id with the given dto', async () => {
    const updated = makeCompany({ reviewCycleEnabled: false });
    mock.onPatch('/org/org-1').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ reviewCycleEnabled: false });
      return [200, updated];
    });

    await expect(companiesApi.update('org-1', { reviewCycleEnabled: false })).resolves.toEqual(
      updated,
    );
  });

  it('removes (soft-deletes) a company by id', async () => {
    mock.onDelete('/org/org-1').reply(204);

    await expect(companiesApi.remove('org-1')).resolves.toBeUndefined();
  });

  it('restores a deleted company by id', async () => {
    const restored = makeCompany({ deletedAt: null });
    mock.onPost('/org/org-1/restore').reply(200, restored);

    await expect(companiesApi.restore('org-1')).resolves.toEqual(restored);
  });

  it('gets orgs for the current user by a comma-joined id list', async () => {
    const companies = [makeCompany({ id: 'org-1' }), makeCompany({ id: 'org-2' })];
    mock.onGet('/org/mine').reply((config) => {
      expect(config.params).toEqual({ ids: 'org-1,org-2' });
      return [200, companies];
    });

    await expect(companiesApi.getMyOrgs(['org-1', 'org-2'])).resolves.toEqual(companies);
  });
});

describe('fetchAllCompanies', () => {
  beforeEach(() => {
    mock.reset();
    vi.mocked(Sentry.captureException).mockClear();
  });

  it('follows nextCursor across pages and returns a flat array', async () => {
    const pageOne = { data: [makeCompany({ id: 'org-1' })], nextCursor: 'cur-2', hasMore: true };
    const pageTwo = { data: [makeCompany({ id: 'org-2' })], nextCursor: null, hasMore: false };
    mock
      .onGet('/org', { params: { limit: 100, cursor: undefined } })
      .replyOnce(200, pageOne)
      .onGet('/org', { params: { limit: 100, cursor: 'cur-2' } })
      .replyOnce(200, pageTwo);

    const all = await fetchAllCompanies();

    expect(all.map((c) => c.id)).toEqual(['org-1', 'org-2']);
  });

  it('reports the failure to Sentry and rethrows when a page fetch fails', async () => {
    mock.onGet('/org').reply(500, { message: 'boom' });

    await expect(fetchAllCompanies()).rejects.toBeTruthy();

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.anything(), {
      tags: { context: 'fetchAllCompanies' },
    });
  });
});
