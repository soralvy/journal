import {
  FormProvider,
  type UseFormReturn,
  type FieldValues,
} from 'react-hook-form';
import { cn, handleServerFormError } from '../../../lib/utils';

interface FormProps<T extends FieldValues> extends Omit<
  React.ComponentProps<'form'>,
  'onSubmit'
> {
  form: UseFormReturn<T>;
  onSubmit: (data: T) => Promise<unknown>;
  children: React.ReactNode;
}

export const Form = <T extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  ...props
}: FormProps<T>) => {
  const handleSubmit = async (data: T) => {
    try {
      await onSubmit(data);
    } catch (error) {
      handleServerFormError(error, form.setError);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} noValidate {...props}>
        <fieldset
          disabled={form.formState.isSubmitting}
          className={cn(
            'm-0 min-w-0 border-none p-0 disabled:pointer-events-none disabled:opacity-70',
            className,
          )}
        >
          {children}
        </fieldset>
      </form>
    </FormProvider>
  );
};
