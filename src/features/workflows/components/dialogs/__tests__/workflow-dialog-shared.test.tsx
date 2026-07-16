import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { ApproversList } from '../workflow-dialog-shared';
import type { ApiUserWithRoles } from '@/lib/api/users';

function makeUser(overrides: Partial<ApiUserWithRoles> = {}): ApiUserWithRoles {
  return {
    id: 'u-1',
    email: 'alice@company.com',
    firstName: 'Alice',
    lastName: 'Smith',
    position: 'Developer',
    idNumber: null,
    departamentoId: null,
    areaId: null,
    cargoId: null,
    isActive: true,
    isSuperAdmin: false,
    registrationStatus: 'active',
    avatarUrl: null,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    roles: [{ roleId: 'role-1', roleName: 'Editor' }],
    orgRemovedAt: null,
    isOptionalReviewer: false,
    ...overrides,
  };
}

const approvers = [
  { id: 'u1', user: makeUser({ id: 'u1', firstName: 'Ana', lastName: 'Gomez' }) },
  { id: 'u2', user: makeUser({ id: 'u2', firstName: 'Beto', lastName: 'Diaz' }) },
  { id: 'u3', user: makeUser({ id: 'u3', firstName: 'Caro', lastName: 'Ruiz' }) },
];

function draggableRowFor(name: string) {
  const el = screen.getByText(name).closest('div[draggable]');
  if (!el) throw new Error(`no draggable row found for "${name}"`);
  return el;
}

describe('ApproversList', () => {
  it('renders approvers in order with 1-based numbered badges', () => {
    render(
      <ApproversList
        approvers={approvers}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        removeLabel="Remove"
      />,
    );
    expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
    expect(screen.getByText('Beto Diaz')).toBeInTheDocument();
    expect(screen.getByText('Caro Ruiz')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders nothing when there are no approvers', () => {
    const { container } = render(
      <ApproversList approvers={[]} onReorder={vi.fn()} onRemove={vi.fn()} removeLabel="Remove" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onRemove with the approver id when its remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <ApproversList
        approvers={approvers}
        onReorder={vi.fn()}
        onRemove={onRemove}
        removeLabel="Remove"
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(onRemove).toHaveBeenCalledWith('u2');
  });

  it('reorders via drag and drop: dragging row 0 onto row 2 calls onReorder(0, 2)', () => {
    // Regression: the GripVertical icon rendered with no draggable attribute
    // or drag event handlers at all — it looked like a drag handle but
    // dragging never moved anything or fired any callback.
    const onReorder = vi.fn();
    render(
      <ApproversList
        approvers={approvers}
        onReorder={onReorder}
        onRemove={vi.fn()}
        removeLabel="Remove"
      />,
    );

    fireEvent.dragStart(draggableRowFor('Ana Gomez'));
    fireEvent.dragOver(draggableRowFor('Caro Ruiz'));
    fireEvent.drop(draggableRowFor('Caro Ruiz'));

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(0, 2);
  });

  it('does not call onReorder when a row is dropped back onto itself', () => {
    const onReorder = vi.fn();
    render(
      <ApproversList
        approvers={approvers}
        onReorder={onReorder}
        onRemove={vi.fn()}
        removeLabel="Remove"
      />,
    );

    const row = draggableRowFor('Beto Diaz');
    fireEvent.dragStart(row);
    fireEvent.dragOver(row);
    fireEvent.drop(row);

    expect(onReorder).not.toHaveBeenCalled();
  });

  // Regression: HTML5 drag-and-drop events only fire for a mouse, and the
  // GripVertical icon isn't a focusable element — a keyboard-only or touch
  // user had no way at all to reorder approvers before these buttons existed.
  describe('keyboard/touch reordering via Up/Down buttons', () => {
    it('exposes real, focusable <button> controls (not just the drag handle) for every approver', () => {
      render(
        <ApproversList
          approvers={approvers}
          onReorder={vi.fn()}
          onRemove={vi.fn()}
          removeLabel="Remove"
        />,
      );

      const upButton = screen.getByRole('button', { name: 'Move Beto Diaz up' });
      expect(upButton.tagName).toBe('BUTTON');
      expect(upButton).not.toHaveAttribute('disabled');
    });

    it('moves an approver down when its Down button is activated', () => {
      const onReorder = vi.fn();
      render(
        <ApproversList
          approvers={approvers}
          onReorder={onReorder}
          onRemove={vi.fn()}
          removeLabel="Remove"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Move Ana Gomez down' }));

      expect(onReorder).toHaveBeenCalledWith(0, 1);
    });

    it('moves an approver up when its Up button is activated', () => {
      const onReorder = vi.fn();
      render(
        <ApproversList
          approvers={approvers}
          onReorder={onReorder}
          onRemove={vi.fn()}
          removeLabel="Remove"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Move Caro Ruiz up' }));

      expect(onReorder).toHaveBeenCalledWith(2, 1);
    });

    it('disables the Up button on the first row and the Down button on the last row', () => {
      render(
        <ApproversList
          approvers={approvers}
          onReorder={vi.fn()}
          onRemove={vi.fn()}
          removeLabel="Remove"
        />,
      );

      expect(screen.getByRole('button', { name: 'Move Ana Gomez up' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move Caro Ruiz down' })).toBeDisabled();
      // The middle row can move in both directions.
      expect(screen.getByRole('button', { name: 'Move Beto Diaz up' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Move Beto Diaz down' })).toBeEnabled();
    });

    it('a disabled boundary button does not call onReorder even if clicked', () => {
      const onReorder = vi.fn();
      render(
        <ApproversList
          approvers={approvers}
          onReorder={onReorder}
          onRemove={vi.fn()}
          removeLabel="Remove"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Move Ana Gomez up' }));

      expect(onReorder).not.toHaveBeenCalled();
    });
  });
});
