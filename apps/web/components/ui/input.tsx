import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border-2 border-ocean-200/60 bg-white px-4 py-3 text-base text-gray-900 shadow-lg transition-all duration-300 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-gray-400 hover:border-ocean-300/80 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ocean-500/20 focus-visible:border-ocean-600 focus-visible:bg-white disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-slate-900 dark:text-white dark:border-ocean-800",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export interface FloatingInputProps extends Omit<React.ComponentProps<"input">, 'placeholder'> {
  label: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, error, className, leftIcon, rightIcon, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(!!props.value || !!props.defaultValue)

    const isActive = focused || hasValue

    return (
      <div className="relative group">
        {/* Input container */}
        <div className="relative">
          {leftIcon && (
            <div className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 z-10",
              isActive ? "text-ocean-600" : "text-gray-400"
            )}>
              {leftIcon}
            </div>
          )}

          <input
            {...props}
            ref={ref}
            className={cn(
              // Base styles
              "w-full rounded-xl border-2 transition-all duration-300 ease-out relative z-0",
              "bg-white",
              "shadow-lg hover:shadow-xl placeholder-transparent",
              "text-gray-800 font-medium",

              // Border and focus styles
              focused
                ? "border-ocean-500 ring-4 ring-ocean-500/20 bg-white shadow-2xl shadow-ocean-500/10"
                : error
                  ? "border-red-400 hover:border-red-500 shadow-red-100"
                  : "border-ocean-200/60 hover:border-ocean-300/80",

              // Size and spacing
              "h-14 px-4 py-4 text-base",
              leftIcon && "pl-12",
              rightIcon && "pr-12",

              className
            )}
            placeholder=" "
            onFocus={(e) => {
              setFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              setHasValue(!!e.target.value)
              props.onBlur?.(e)
            }}
            onChange={(e) => {
              setHasValue(!!e.target.value)
              props.onChange?.(e)
            }}
          />

          {rightIcon && (
            <div className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-300 z-10",
              isActive ? "text-ocean-600" : "text-gray-400"
            )}>
              {rightIcon}
            </div>
          )}
        </div>

        {/* Floating label */}
        <label
          className={cn(
            "absolute transition-all duration-300 ease-out pointer-events-none z-10",
            "font-semibold select-none",
            isActive
              ? [
                "-top-3 left-3 text-xs px-3 py-1.5",
                "bg-linear-to-r from-white via-ocean-50 to-white rounded-lg shadow-md",
                error ? "text-red-600 border border-red-200" : "text-ocean-600 border border-ocean-200/60",
              ]
              : [
                "top-1/2 -translate-y-1/2 text-base left-4",
                "text-gray-500"
              ],
            leftIcon && isActive && "left-3",
            leftIcon && !isActive && "left-12"
          )}
        >
          {label}
        </label>

        {/* Error message */}
        {error && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
      </div>
    )
  }
)
FloatingInput.displayName = "FloatingInput"

export { Input, FloatingInput }
