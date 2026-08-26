import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Shows an inline "×" in the trigger to reset to `value=""` without opening the dropdown. */
  clearable?: boolean;
  clearLabel?: string;
  /** Set on the trigger button so an external `<label htmlFor>` can point at it. */
  id?: string;
  /** Merged (via cn/tailwind-merge) onto the trigger button — lets a caller match its
   *  own filter bar's height/radius/background instead of this component's defaults. */
  triggerClassName?: string;
  /** Closed trigger shows only `label`, omitting `sublabel` — e.g. a typology filter
   *  that wants just the code once selected. The open dropdown list is unaffected;
   *  it always shows both. */
  hideSelectedSublabel?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Sin resultados',
  disabled = false,
  onOpenChange,
  clearable = false,
  clearLabel = 'Limpiar',
  id,
  triggerClassName,
  hideSelectedSublabel = false,
}: SearchableSelectProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);

  const setOpenWithCallback = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      (o.sublabel?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenWithCallback(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setOpenWithCallback]);

  const handleSelect = (option: SelectOption) => {
    onChange(option.value);
    setOpenWithCallback(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => !disabled && setOpenWithCallback(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpenWithCallback(false);
            setSearch('');
          }
        }}
        className={cn(
          'flex items-center justify-between w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
          'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          clearable && 'pr-8',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'ring-1 ring-ring',
          triggerClassName,
        )}
      >
        {selected ? (
          <span className="flex flex-col text-left min-w-0">
            <span className="font-medium truncate">{selected.label}</span>
            {!hideSelectedSublabel && selected.sublabel && (
              <span className="text-xs text-muted-foreground truncate">{selected.sublabel}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground truncate">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground shrink-0 ml-2 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Sibling of the trigger (not nested inside it) so it stays a real,
          independently focusable button instead of an interactive element
          nested inside another one. */}
      {clearable && value !== '' && (
        <button
          type="button"
          disabled={disabled}
          aria-label={clearLabel}
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
          }}
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="size-3.5" />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md"
        >
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                autoFocus
                className="h-8 pl-7 text-sm"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenWithCallback(false);
                    setSearch('');
                  }
                }}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent transition-colors',
                    option.value === value && 'bg-accent/50',
                  )}
                >
                  {/* Unlike the closed trigger, the open list has room to spare —
                      let long labels/sublabels wrap instead of clipping them. */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">{option.label}</p>
                    {option.sublabel && (
                      <p className="text-xs text-muted-foreground break-words">{option.sublabel}</p>
                    )}
                  </div>
                  {option.value === value && <Check className="size-3.5 text-primary shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
