'use client'

import Image from 'next/image'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

const sizes = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
}

export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {/* Logo with pulse animation - LSP Gatensi Brand Colors */}
      <div className={`relative ${sizes[size]}`}>
        <div className="absolute inset-0 bg-brand-red-400 rounded-full opacity-20 animate-ping" />
        <div className="absolute inset-0 bg-brand-blue-400 rounded-full opacity-30 animate-pulse" />
        <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-brand-red-100">
          <Image
            src="/logo2.png"
            alt="Loading..."
            fill
            className="object-contain p-3"
          />
        </div>
      </div>

      {/* Optional text */}
      {text && (
        <p className="text-sm text-gray-600 animate-pulse font-medium">{text}</p>
      )}

      {/* Loading dots with LSP Gatensi colors */}
      <div className="flex gap-2">
        <div className="w-2 h-2 bg-brand-red-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-brand-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-brand-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// Full page loading overlay with LSP Gatensi branding
export function FullPageLoader({ text = 'Memuat...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6">
        {/* LSP Gatensi branded spinner */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-brand-red-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-brand-red-600 rounded-full border-t-transparent animate-spin" />
          <div className="absolute inset-2 border-4 border-brand-blue-100 rounded-full" />
          <div className="absolute inset-2 border-4 border-brand-blue-600 rounded-full border-b-transparent animate-spin" style={{ animationDirection: 'reverse' }} />
          <Image
            src="/logo2.png"
            alt="Loading..."
            fill
            className="object-contain p-4"
          />
        </div>
        <p className="text-lg font-semibold text-brand-blue-900">{text}</p>
      </div>
    </div>
  )
}

// Inline loading component for cards/sections
export function InlineLoader({ text = 'Memuat...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12 gap-3">
      <div className="w-5 h-5 border-3 border-brand-red-200 border-t-brand-red-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  )
}

// Spinning logo loader
export function SpinningLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="animate-spin">
        <Image
          src="/logo2.png"
          alt="Loading..."
          width={40}
          height={40}
          className="opacity-80"
        />
      </div>
      {/* Spinning ring with LSP Gatensi colors */}
      <div className="absolute inset-0 border-2 border-brand-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// Bounce logo loader
export function BounceLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="animate-bounce">
        <Image
          src="/logo2.png"
          alt="Loading..."
          width={48}
          height={48}
        />
      </div>
    </div>
  )
}

// Pulse logo loader with LSP Gatensi branding
export function PulseLogo({ className = '', text }: { className?: string; text?: string }) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="relative">
        {/* Pulse rings with LSP Gatensi colors */}
        <div className="absolute inset-0 bg-brand-red-400 rounded-full opacity-20 animate-ping" />
        <div className="absolute inset-0 bg-brand-blue-400 rounded-full opacity-30 animate-pulse" />

        {/* Logo */}
        <div className="relative bg-white rounded-full p-4 shadow-lg border-2 border-brand-red-100">
          <Image
            src="/logo2.png"
            alt="Loading..."
            width={48}
            height={48}
          />
        </div>
      </div>

      {text && <p className="text-sm text-gray-600 font-medium">{text}</p>}
    </div>
  )
}

// LSP Gatensi branded spinner (no image)
export function LSPSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  }

  return (
    <div className={`relative ${sizes[size]} ${className}`}>
      <div className="absolute inset-0 border-brand-red-200 rounded-full" />
      <div className="absolute inset-0 border-brand-red-600 rounded-full border-t-transparent animate-spin" />
      <div className="absolute inset-2 border-brand-blue-200 rounded-full" />
      <div className="absolute inset-2 border-brand-blue-600 rounded-full border-b-transparent animate-spin" style={{ animationDirection: 'reverse' }} />
    </div>
  )
}

// Skeleton card for loading states
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <div className="space-y-4">
        <div className="h-6 bg-slate-200 rounded animate-pulse w-1/3"></div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
          <div className="h-4 bg-slate-200 rounded animate-pulse w-5/6"></div>
        </div>
      </div>
    </div>
  )
}

// Skeleton stats card
export function SkeletonStatsCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 bg-slate-200 rounded-lg animate-pulse"></div>
          <div className="h-6 bg-slate-200 rounded animate-pulse w-20"></div>
        </div>
        <div className="h-8 bg-slate-200 rounded animate-pulse w-16"></div>
        <div className="h-4 bg-slate-200 rounded animate-pulse w-full"></div>
      </div>
    </div>
  )
}

// Skeleton table row
export function SkeletonTableRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center space-x-4 p-4 border-b border-slate-100 ${className}`}>
      <div className="h-10 w-10 bg-slate-200 rounded-full animate-pulse"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded animate-pulse w-1/4"></div>
        <div className="h-3 bg-slate-200 rounded animate-pulse w-1/6"></div>
      </div>
      <div className="h-8 w-24 bg-slate-200 rounded animate-pulse"></div>
    </div>
  )
}
