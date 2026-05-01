import {
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form';

import { AppValidationError } from '../errors';

export const handleServerFormError = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
) => {
  if (error instanceof AppValidationError) {
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      setError(field as Path<T>, {
        type: 'server',
        message,
      });
    }
    return;
  }

  const fallbackMessage =
    error instanceof Error ? error.message : 'An unexpected error occurred.';
  setError('root', {
    type: 'server',
    message: fallbackMessage,
  });
};
