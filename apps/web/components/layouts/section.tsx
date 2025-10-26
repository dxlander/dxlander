import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const sectionVariants = cva('relative', {
  variants: {
    variant: {
      default: '',
      centered: 'text-center',
      hero: 'text-center py-20',
      compact: 'py-8',
    },
    spacing: {
      none: '',
      sm: 'py-8',
      md: 'py-12',
      lg: 'py-16',
      xl: 'py-20',
    },
    background: {
      transparent: '',
      subtle: 'bg-ocean-50/20',
      card: 'bg-white/80 backdrop-blur-sm border border-ocean-200/30 rounded-2xl shadow-lg',
      gradient: 'bg-gradient-to-r from-ocean-50/30 to-ocean-100/20',
    },
  },
  defaultVariants: {
    variant: 'default',
    spacing: 'md',
    background: 'transparent',
  },
});

export interface SectionProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sectionVariants> {
  children: React.ReactNode;
  container?: boolean;
}

const Section = React.forwardRef<HTMLDivElement, SectionProps>(
  ({ className, variant, spacing, background, children, container = true, ...props }, ref) => {
    const content = container ? <div className="container mx-auto px-6">{children}</div> : children;

    return (
      <section
        ref={ref}
        className={cn(sectionVariants({ variant, spacing, background, className }))}
        {...props}
      >
        {content}
      </section>
    );
  }
);
Section.displayName = 'Section';

export { Section, sectionVariants };
