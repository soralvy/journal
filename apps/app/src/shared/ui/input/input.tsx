import { cn } from '../../../lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  hasError?: boolean;
  endIcon?: React.ReactNode;
}

export const Input = ({
  className,
  type = 'text',
  hasError = false,
  endIcon,
  ref,
  ...props
}: InputProps) => {
  return (
    <div className="relative flex w-full items-center">
      <input
        ref={ref}
        type={type}
        aria-invalid={hasError ? 'true' : 'false'}
        className={cn(
          'font-display bg-background text-primary placeholder:text-secondary flex h-[50px] w-full rounded-xl border border-[#E2E8F0] px-4 text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          hasError &&
            'border-destructive text-destructive focus-visible:ring-destructive',
          endIcon && 'pr-12',
          className,
        )}
        {...props}
      />
      {endIcon && (
        <div className="text-muted-foreground absolute right-4 flex items-center justify-center">
          {endIcon}
        </div>
      )}
    </div>
  );
};
