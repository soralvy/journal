import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../../lib/utils';

const labelVariants = cva(
  'font-display text-primary text-sm leading-none font-semibold peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
);

export interface LabelProps
  extends React.ComponentProps<'label'>, VariantProps<typeof labelVariants> {}

export interface LabelProps
  extends React.ComponentProps<'label'>, VariantProps<typeof labelVariants> {}

export const Label = ({ className, ref, ...props }: LabelProps) => {
  return (
    <label ref={ref} className={cn(labelVariants(), className)} {...props} />
  );
};
