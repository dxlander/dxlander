import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import Image from "next/image"

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  title?: string
  subtitle?: string
  badge?: string
  actions?: React.ReactNode
  showBorder?: boolean
  transparent?: boolean
}

const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({
    className,
    title = "DXLander",
    subtitle,
    badge,
    actions,
    showBorder = true,
    transparent = false,
    ...props
  }, ref) => {
    return (
      <header
        ref={ref}
        className={cn(
          "relative",
          showBorder && "border-b border-ocean-200/60",
          transparent ? "bg-transparent" : "bg-white/95 backdrop-blur-sm",
          className
        )}
        {...props}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left side: Logo + Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link href="/dashboard" className="flex-shrink-0">
                <Image
                  src="/logo.svg"
                  alt="DXLander"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
              </Link>

              <div className="min-w-0 flex-1">
                {/* Title row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-gradient-ocean truncate">
                    {title}
                  </h1>
                  {badge && (
                    <Badge variant="secondary" className="text-xs bg-ocean-100 text-ocean-700 border-ocean-200 flex-shrink-0">
                      {badge}
                    </Badge>
                  )}
                </div>

                {/* Subtitle row - only on larger screens */}
                {subtitle && (
                  <p className="text-xs sm:text-sm text-ocean-600 mt-0.5 line-clamp-1 hidden sm:block">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Right side: Actions */}
            {actions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        </div>
      </header>
    )
  }
)
Header.displayName = "Header"

export { Header }