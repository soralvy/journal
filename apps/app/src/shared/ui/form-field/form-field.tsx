import { useId } from 'react';

import { Input } from '../input/input';
import { Label } from '../label/label';

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
}

export const FormField = ({ label, hint, error }: FormFieldProps) => {
  // React 19 useId hook ensures SSR-safe, globally unique IDs
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasHint = hint !== undefined && hint !== '';
  const hasError = error !== undefined && error !== '';

  // Conditionally build the aria-describedby string
  const describedByValue = [hasHint ? hintId : null, hasError ? errorId : null]
    .filter((item): item is string => item !== null)
    .join(' ');
  const describedBy = describedByValue === '' ? undefined : describedByValue;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className={hasError ? 'text-destructive' : ''}>
        {label}
      </Label>

      <Input id={id} hasError={hasError} aria-describedby={describedBy} />

      {hasHint && !hasError && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}

      {hasError && (
        <p
          id={errorId}
          className="text-destructive text-sm font-medium"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};
