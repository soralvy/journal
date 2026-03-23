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

  // Conditionally build the aria-describedby string
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className={error ? 'text-destructive' : ''}>
        {label}
      </Label>

      <Input id={id} hasError={!!error} aria-describedby={describedBy} />

      {hint && !error && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}

      {error && (
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
