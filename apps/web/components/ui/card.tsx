import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-2xl border-2 bg-card text-gray-900 shadow-xl transition-all duration-300 ease-out',
  {
    variants: {
      variant: {
        default:
          'border-ocean-200/50 bg-white shadow-lg shadow-ocean-500/5 hover:shadow-xl hover:shadow-ocean-500/10 hover:border-ocean-300/60',
        interactive:
          'border-ocean-200/60 bg-white shadow-ocean-500/10 hover:shadow-2xl hover:shadow-ocean-500/25 hover:border-ocean-400/70 hover:scale-[1.02] cursor-pointer',
        elevated:
          'border-ocean-300/50 bg-ocean-50/30 shadow-2xl shadow-ocean-500/15 hover:shadow-3xl hover:shadow-ocean-500/25 hover:border-ocean-400/60',
        glass:
          'border-white/25 bg-white/15 backdrop-blur-xl shadow-2xl shadow-ocean-500/10 hover:bg-white/20',
        gradient:
          'border-ocean-300/50 bg-ocean-50/50 shadow-2xl shadow-ocean-500/15 hover:shadow-3xl hover:shadow-ocean-500/25',
        disabled: 'border-gray-200 bg-gray-50/80 shadow-sm cursor-not-allowed opacity-60',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, className }))} {...props} />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
