import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import {
  type FieldPath,
  type FieldValues,
  useController,
} from 'react-hook-form';

import { Input } from '../input/input';
import { Label } from '../label/label';

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

interface PasswordToggleButtonProps {
  onToggle: () => void;
  showPassword: boolean;
}

interface EndIconOptions {
  hasErrorMessage: boolean;
  invalid: boolean;
  isDirty: boolean;
  isPassword: boolean;
  onTogglePassword: () => void;
  shouldShowSuccessIndicator: boolean;
  showPassword: boolean;
}

const getDescribedBy = (
  hintId: string,
  errorId: string,
  hasHint: boolean,
  hasErrorMessage: boolean,
) => {
  return [hasHint ? hintId : null, hasErrorMessage ? errorId : null]
    .filter((item): item is string => item !== null)
    .join(' ');
};

const PasswordToggleButton = ({
  onToggle,
  showPassword,
}: PasswordToggleButtonProps) => {
  return (
    <button
      type="button"
      onClick={onToggle}
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
};

const getEndIconState = ({
  hasErrorMessage,
  invalid,
  isDirty,
  isPassword,
  onTogglePassword,
  shouldShowSuccessIndicator,
  showPassword,
}: EndIconOptions): { node: React.ReactNode } => {
  if (isPassword) {
    return {
      node: (
        <PasswordToggleButton
          onToggle={onTogglePassword}
          showPassword={showPassword}
        />
      ),
    };
  }

  if (shouldShowSuccessIndicator && isDirty && !invalid && !hasErrorMessage) {
    return {
      node: (
        <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
      ),
    };
  }

  return { node: null };
};

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
  const passwordInputType = showPassword ? 'text' : 'password';
  const currentType = isPassword ? passwordInputType : type;

  const errorMessage = error?.message;
  const hasClassName = className !== undefined && className !== '';
  const hasHint = hint !== undefined && hint !== '';
  const hasErrorMessage = errorMessage !== undefined && errorMessage !== '';
  const hasRightLabelSlot =
    rightLabelSlot !== undefined && rightLabelSlot !== null;
  const isRequiredField = isRequired === true;
  const shouldShowSuccessIndicator = showSuccessIndicator === true;

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedByValue = getDescribedBy(
    hintId,
    errorId,
    hasHint,
    hasErrorMessage,
  );
  const describedBy = describedByValue === '' ? undefined : describedByValue;
  const endIcon = getEndIconState({
    hasErrorMessage,
    invalid,
    isDirty,
    isPassword,
    onTogglePassword: () => {
      setShowPassword(!showPassword);
    },
    shouldShowSuccessIndicator,
    showPassword,
  }).node;

  return (
    <div className={`flex flex-col gap-2 ${hasClassName ? className : ''}`}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className={hasErrorMessage ? 'text-destructive' : ''}
        >
          {label}
          {isRequiredField && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>

        {hasRightLabelSlot && (
          <div className="text-sm font-medium">{rightLabelSlot}</div>
        )}
      </div>

      <Input
        id={id}
        type={currentType}
        hasError={hasErrorMessage}
        endIcon={endIcon}
        aria-describedby={describedBy}
        aria-required={isRequired}
        {...field}
        {...props}
      />

      {hasHint && !hasErrorMessage && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}

      {hasErrorMessage && (
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
