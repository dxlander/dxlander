import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden cursor-pointer disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-ocean-700 via-ocean-600 to-ocean-500 text-white shadow-lg hover:shadow-xl hover:shadow-ocean-500/30 hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        destructive:
          "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]",
        outline:
          "border-2 border-ocean-200 bg-white/50 backdrop-blur-sm text-ocean-700 shadow-md hover:shadow-lg hover:bg-ocean-50/80 hover:border-ocean-300 hover:scale-[1.02] active:scale-[0.98]",
        secondary:
          "bg-gradient-to-r from-ocean-50 to-ocean-100 text-ocean-800 shadow-md hover:shadow-lg hover:from-white hover:to-ocean-50 hover:scale-[1.02] active:scale-[0.98] border border-ocean-200/50",
        ghost:
          "text-ocean-700 hover:bg-gradient-to-r hover:from-ocean-50 hover:to-ocean-100 hover:text-ocean-800 hover:scale-[1.02] active:scale-[0.98]",
        link:
          "text-ocean-600 underline-offset-4 hover:underline hover:text-ocean-700",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-11 w-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
