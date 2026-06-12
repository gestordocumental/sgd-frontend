import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  description?: string;
  children: React.ReactNode;
}

export function FormField({ id, label, error, description, children }: FormFieldProps) {
  const { t } = useTranslation();

  const descId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(' ') || undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        'aria-describedby': describedBy,
        ...(error && { 'aria-invalid': true, 'aria-errormessage': errorId }),
      })
    : children;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {child}
      {description && !error && (
        <p id={descId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}
