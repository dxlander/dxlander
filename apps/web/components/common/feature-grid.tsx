import * as React from "react"
import { cn } from "@/lib/utils"
import { IconWrapper } from "./icon-wrapper"

export interface FeatureItem {
  icon: React.ReactNode
  title: string
  description: string
  iconVariant?: "default" | "primary" | "secondary" | "ghost" | "outline"
}

export interface FeatureGridProps extends React.HTMLAttributes<HTMLDivElement> {
  features: FeatureItem[]
  columns?: 1 | 2 | 3 | 4
  gap?: "sm" | "md" | "lg"
}

const FeatureGrid = React.forwardRef<HTMLDivElement, FeatureGridProps>(
  ({ className, features, columns = 3, gap = "md", ...props }, ref) => {
    const columnClasses = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    }

    const gapClasses = {
      sm: "gap-4",
      md: "gap-6",
      lg: "gap-8",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid",
          columnClasses[columns],
          gapClasses[gap],
          className
        )}
        {...props}
      >
        {features.map((feature, index) => (
          <div key={index} className="text-center">
            <IconWrapper
              variant={feature.iconVariant || "default"}
              size="lg"
              className="mx-auto mb-3"
            >
              {feature.icon}
            </IconWrapper>
            <h3 className="font-semibold mb-2 text-gray-900">{feature.title}</h3>
            <p className="text-sm text-gray-600">{feature.description}</p>
          </div>
        ))}
      </div>
    )
  }
)
FeatureGrid.displayName = "FeatureGrid"

export { FeatureGrid }