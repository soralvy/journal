import { useId, useState } from 'react';
import {
  useController,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Input } from '../input/input';
import { Label } from '../label/label';

import { CheckCircle2, Eye, EyeOff } from 'lucide-react';

export interface FormInputProps<T extends FieldValues> extends Omit<
  React.ComponentProps<'input'>,
  'name' | 'id'
> {
  name: FieldPath<T>;
  label: string;
  hint?: string;
  isRequired?: boolean;
  rightLabelSlot?: React.ReactNode;
  showSuccessIndicator?: boolean;
}

export const FormInput = <T extends FieldValues>({
  label,
  hint,
  type = 'text',
  className,
  name,
  isRequired,
  showSuccessIndicator,
  rightLabelSlot,
  ...props
}: FormInputProps<T>) => {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);

  const {
    field,
    fieldState: { error, isDirty, invalid },
  } = useController({ name });

  const isPassword = type === 'password';
  const currentType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const errorMessage = error?.message;

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, errorMessage ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  let endIcon = null;
  if (isPassword) {
    endIcon = (
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="hover:text-primary rounded-sm transition-colors focus-visible:outline-none"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? (
          <EyeOff className="h-5 w-5" />
        ) : (
          <Eye className="h-5 w-5" />
        )}
      </button>
    );
  } else if (showSuccessIndicator && isDirty && !invalid && !errorMessage) {
    endIcon = (
      <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className={errorMessage ? 'text-destructive' : ''}>
          {label}
          {isRequired && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>

        {rightLabelSlot && (
          <div className="text-sm font-medium">{rightLabelSlot}</div>
        )}
      </div>

      <Input
        id={id}
        type={currentType}
        hasError={!!errorMessage}
        endIcon={endIcon}
        aria-describedby={describedBy}
        aria-required={isRequired}
        {...field}
        {...props}
      />

      {hint && !errorMessage && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}

      {errorMessage && (
        <p
          id={errorId}
          className="text-destructive text-sm font-medium"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
};
