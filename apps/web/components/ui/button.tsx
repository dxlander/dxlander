import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden cursor-pointer disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-ocean-700 via-ocean-600 to-ocean-500 dark:from-ocean-600 dark:via-ocean-500 dark:to-ocean-400 text-white shadow-lg hover:shadow-xl hover:shadow-ocean-500/30 hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity',
        destructive:
          'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-500 text-white shadow-lg hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]',
        outline:
          'border-2 border-ocean-200 dark:border-ocean-800 bg-background/50 backdrop-blur-sm text-ocean-700 dark:text-ocean-300 shadow-md hover:shadow-lg hover:bg-ocean-50/80 dark:hover:bg-ocean-950/80 hover:border-ocean-300 dark:hover:border-ocean-700 hover:scale-[1.02] active:scale-[0.98]',
        secondary:
          'bg-gradient-to-r from-ocean-50 to-ocean-100 dark:from-ocean-950 dark:to-ocean-900 text-ocean-800 dark:text-ocean-200 shadow-md hover:shadow-lg hover:from-background hover:to-ocean-50 dark:hover:from-ocean-900 dark:hover:to-ocean-950 hover:scale-[1.02] active:scale-[0.98] border border-ocean-200/50 dark:border-ocean-800/50',
        ghost:
          'text-foreground/80 hover:text-foreground hover:bg-muted/80 dark:hover:bg-muted/50 hover:scale-[1.02] active:scale-[0.98]',
        link: 'text-ocean-600 dark:text-ocean-400 underline-offset-4 hover:underline hover:text-ocean-700 dark:hover:text-ocean-300',
      },
      size: {
        default: 'h-11 px-6 py-3',
        sm: 'h-9 rounded-lg px-4 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'h-11 w-11 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
