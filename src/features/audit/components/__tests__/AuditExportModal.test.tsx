import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import i18n from '@/i18n';
import { AuditExportModal } from '../AuditExportModal';
import type { AuditLogEntry } from '@/lib/api/audit';

const mockExportLogs = vi.fn();
vi.mock('@/lib/api/audit', () => ({
  auditApi: {
    exportLogs: (...args: unknown[]) => mockExportLogs(...args),
  },
}));

function makeLog(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'log-1',
    service: 'user-service',
    actorId: 'user-1',
    actorName: 'Ana Gomez',
    orgId: 'org-1',
    action: 'USER_UPDATED',
    resourceType: 'user',
    resourceId: 'user-2',
    resourceName: 'Beto Diaz',
    correlationId: null,
    ip: '127.0.0.1',
    metadata: {
      changes: {
        isActive: { from: true, to: false },
      },
    },
    timestamp: '2024-01-15T10:00:00Z',
    indexedAt: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

describe('AuditExportModal', () => {
  let createdBlob: Blob | null = null;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    mockExportLogs.mockReset();
    createdBlob = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      createdBlob = blob;
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('translates the "Changes" column field names into the active locale instead of the raw English backend key', async () => {
    // Regression: AuditDetailModal (the on-screen detail view) translates
    // each changed field via formatFieldName(field, t) — audit.fields.<field>
    // in i18n — but the export built its "Cambios" text with the raw field
    // key straight from the backend's metadata, so exporting with the
    // platform set to Spanish still showed English field names like
    // "isActive" instead of "Estado".
    mockExportLogs.mockResolvedValue([makeLog()]);

    render(<AuditExportModal open onClose={vi.fn()} companyId="org-1" />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('audit.export.download') }));

    await waitFor(() => expect(createdBlob).not.toBeNull());

    const buffer = await createdBlob!.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.worksheets[0];
    const lastCol = sheet.getRow(1).cellCount;
    const changesHeader = sheet.getRow(1).getCell(lastCol).text;
    const changesValue = sheet.getRow(2).getCell(lastCol).text;

    expect(changesHeader).toBe(i18n.t('audit.detail.changes'));

    const translatedLabel = i18n.t('audit.fields.isActive');
    expect(changesValue).toContain(translatedLabel);
    // The raw backend key must not leak through as a standalone field label.
    expect(changesValue).not.toContain('isActive:');
  });

  it('falls back to the raw field key in the exported Excel when there is no audit.fields translation for it', async () => {
    // Companion to the test above: formatFieldName falls back to the raw key
    // when audit.fields.<field> has no entry (see AuditDetailModal's matching
    // fallback test) — verifying the export takes the same fallback path
    // instead of, say, dropping the field or throwing.
    mockExportLogs.mockResolvedValue([
      makeLog({ metadata: { changes: { someUntranslatedField: { from: 'a', to: 'b' } } } }),
    ]);

    render(<AuditExportModal open onClose={vi.fn()} companyId="org-1" />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('audit.export.download') }));

    await waitFor(() => expect(createdBlob).not.toBeNull());

    const buffer = await createdBlob!.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.worksheets[0];
    const lastCol = sheet.getRow(1).cellCount;
    const changesValue = sheet.getRow(2).getCell(lastCol).text;

    expect(changesValue).toContain('someUntranslatedField:');
  });

  it('does not crash the whole export when one log has malformed metadata.changes', async () => {
    // Regression: metadata.changes comes out of Elasticsearch as loosely-typed
    // JSON — a value that isn't {from, to}-shaped (null, a string, etc.) used
    // to blow up the destructuring inside the map and abort the export for
    // every row, not just the bad one.
    mockExportLogs.mockResolvedValue([
      makeLog({ id: 'log-bad', metadata: { changes: { corrupted: null } } }),
      makeLog({ id: 'log-good', resourceName: 'Caro Ruiz' }),
    ]);

    render(<AuditExportModal open onClose={vi.fn()} companyId="org-1" />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('audit.export.download') }));

    await waitFor(() => expect(createdBlob).not.toBeNull());

    const buffer = await createdBlob!.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.worksheets[0];
    const lastCol = sheet.getRow(1).cellCount;

    // The malformed row still exports (empty "Cambios" instead of a crash)...
    expect(sheet.getRow(2).getCell(lastCol).text).toBe('');
    // ...and the row after it isn't dropped either.
    expect(sheet.rowCount).toBe(3);
  });
});
