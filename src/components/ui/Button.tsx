import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-academia-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-academia-bg-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-academia-accent-gold text-academia-bg-primary hover:bg-academia-accent-goldBright',
        secondary:
          'bg-academia-bg-tertiary text-academia-text-primary hover:bg-academia-bg-elevated border border-academia-border',
        ghost:
          'hover:bg-academia-bg-tertiary text-academia-text-secondary hover:text-academia-text-primary',
        outline:
          'border border-academia-border bg-transparent hover:bg-academia-bg-tertiary text-academia-text-primary',
        success:
          'bg-academia-success text-academia-text-primary hover:bg-academia-success/90',
        danger:
          'bg-academia-error text-academia-text-primary hover:bg-academia-error/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };