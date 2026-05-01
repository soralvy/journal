import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../../lib/utils';

const buttonVariants = cva(
  'focus-visible:ring-ring leading inline-flex cursor-pointer items-center justify-center rounded-xl text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline:
          'border-input bg-background hover:bg-accent hover:text-accent-foreground border',
      },
      size: {
        default: 'h-10 px-4 py-3.5',
        sm: 'h-9 rounded-md px-3 py-2',
        lg: 'h-11 rounded-xl px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ref,
  ...props
}: ButtonProps) => {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};
