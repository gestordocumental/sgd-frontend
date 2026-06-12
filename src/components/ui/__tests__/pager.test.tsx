import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import i18n from '@/i18n';
import { Pager } from '../pager';

// ── development-mode prop validation ──────────────────────────────────────────

describe('Pager — development prop validation', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('DEV', true); // enables import.meta.env.DEV in the component
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('warns when page is 0', () => {
    render(<Pager page={0} totalPages={3} onChange={vi.fn()} />);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Pager]'));
  });

  it('warns when page exceeds totalPages', () => {
    render(<Pager page={5} totalPages={3} onChange={vi.fn()} />);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Pager]'));
  });

  it('warns when totalPages is 0', () => {
    render(<Pager page={1} totalPages={0} onChange={vi.fn()} />);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Pager]'));
  });

  it('does not warn for valid props', () => {
    render(<Pager page={2} totalPages={3} onChange={vi.fn()} />);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

// ── page/totalPages mode ───────────────────────────────────────────────────────

describe('Pager — page/totalPages mode', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the page indicator', () => {
    render(<Pager page={2} totalPages={5} onChange={vi.fn()} />);
    // Use selector:'span' — ancestor divs also have textContent "2 / 5" in this
    // minimal DOM and would cause a multiple-match error without the restriction.
    expect(screen.getByText('2 / 5', { selector: 'span' })).toBeInTheDocument();
  });

  it('shows results count when total is provided', () => {
    render(<Pager page={1} totalPages={3} total={25} onChange={vi.fn()} />);
    expect(screen.getByText('25 results')).toBeInTheDocument();
  });

  it('does not render a results count when total is absent', () => {
    render(<Pager page={1} totalPages={3} onChange={vi.fn()} />);
    expect(screen.queryByText(/results/i)).toBeNull();
  });

  it('disables prev button on the first page', () => {
    render(<Pager page={1} totalPages={3} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('disables next button on the last page', () => {
    render(<Pager page={3} totalPages={3} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('enables both buttons on a middle page', () => {
    render(<Pager page={2} totalPages={3} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
  });

  it('calls onChange(page - 1) when prev is clicked', () => {
    const onChange = vi.fn();
    render(<Pager page={2} totalPages={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('calls onChange(page + 1) when next is clicked', () => {
    const onChange = vi.fn();
    render(<Pager page={2} totalPages={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('uses justify-between layout when total is provided', () => {
    const { container } = render(<Pager page={1} totalPages={2} total={10} onChange={vi.fn()} />);
    expect(container.firstChild).toHaveClass('justify-between');
  });

  it('uses justify-end layout when total is absent', () => {
    const { container } = render(<Pager page={1} totalPages={2} onChange={vi.fn()} />);
    expect(container.firstChild).toHaveClass('justify-end');
  });
});

// ── prev/next mode ─────────────────────────────────────────────────────────────

describe('Pager — prev/next mode', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders two nav buttons', () => {
    render(<Pager hasPrev hasNext onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('disables prev button when hasPrev is false', () => {
    render(<Pager hasPrev={false} hasNext onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('disables next button when hasNext is false', () => {
    render(<Pager hasPrev hasNext={false} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('enables both buttons when hasPrev and hasNext are true', () => {
    render(<Pager hasPrev hasNext onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
  });

  it('calls onPrev when prev button is clicked', () => {
    const onPrev = vi.fn();
    render(<Pager hasPrev hasNext onPrev={onPrev} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('calls onNext when next button is clicked', () => {
    const onNext = vi.fn();
    render(<Pager hasPrev hasNext onPrev={vi.fn()} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────────

describe('Pager — accessibility', () => {
  it('page/totalPages mode has no WCAG 2.1 AA violations', async () => {
    const { container } = render(<Pager page={2} totalPages={5} total={50} onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('prev/next mode has no WCAG 2.1 AA violations', async () => {
    const { container } = render(<Pager hasPrev hasNext onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
