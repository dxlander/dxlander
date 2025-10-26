import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const iconWrapperVariants = cva(
  'flex items-center justify-center rounded-lg transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-ocean-100 text-ocean-600',
        primary: 'bg-gradient-to-r from-ocean-600 to-ocean-700 text-white shadow-lg',
        secondary: 'bg-ocean-50 text-ocean-700 border border-ocean-200',
        ghost: 'bg-transparent text-ocean-600',
        outline: 'bg-white border-2 border-ocean-200 text-ocean-600 hover:bg-ocean-50',
      },
      size: {
        xs: 'w-6 h-6',
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16',
      },
      radius: {
        sm: 'rounded-md',
        md: 'rounded-lg',
        lg: 'rounded-xl',
        full: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      radius: 'md',
    },
  }
);

export interface IconWrapperProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconWrapperVariants> {
  children: React.ReactNode;
}

const IconWrapper = React.forwardRef<HTMLDivElement, IconWrapperProps>(
  ({ className, variant, size, radius, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(iconWrapperVariants({ variant, size, radius, className }))}
        {...props}
      >
        {children}
      </div>
    );
  }
);
IconWrapper.displayName = 'IconWrapper';

export { IconWrapper, iconWrapperVariants };
