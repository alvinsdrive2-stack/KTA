"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const AnimatedProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    value?: number
  }
>(({ className, value = 0, ...props }, ref) => {
  // Calculate color based on percentage
  const getColorClass = (percentage: number) => {
    if (percentage <= 25) return "bg-red-500" // 0-25%: Red
    if (percentage <= 50) return "bg-orange-500" // 26-50%: Orange
    if (percentage <= 75) return "bg-yellow-500" // 51-75%: Yellow
    return "bg-green-500" // 76-100%: Green
  }

  return (
    <div className="relative w-full">
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative h-6 w-full overflow-hidden rounded-full bg-gray-200",
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full transition-all duration-1000 ease-out relative overflow-hidden",
            getColorClass(value)
          )}
          style={{
            transform: `translateX(-${100 - (value || 0)}%)`,
            transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Shimmer effect */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
              animation: value > 0 ? 'shimmer 2s infinite' : 'none'
            }}
          />
        </ProgressPrimitive.Indicator>

        {/* Glow effect when complete */}
        {value >= 100 && (
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)'
            }}
          />
        )}
      </ProgressPrimitive.Root>

      {/* Percentage label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(
          "text-sm font-medium transition-colors duration-500",
          value >= 75 ? "text-white" : "text-gray-700",
          value >= 50 && value < 75 && "text-white",
          value >= 25 && value < 50 && "text-white",
          value < 25 && "text-white"
        )}>
          {value}%
        </span>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  )
})
AnimatedProgress.displayName = "AnimatedProgress"

export { AnimatedProgress }