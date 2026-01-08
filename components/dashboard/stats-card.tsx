'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface StatsCardProps {
  title: string
  value: number
  icon: LucideIcon
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'slate'
  delay?: number
}

// Muted chill colors - no gradients
const colorStyles = {
  slate: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-200',
    iconColor: 'text-slate-700',
    trendBg: 'bg-slate-200',
    trendText: 'text-slate-700',
    bar: 'bg-slate-400',
  },
  blue: {
    bg: 'bg-sky-50',
    iconBg: 'bg-sky-200',
    iconColor: 'text-sky-700',
    trendBg: 'bg-sky-200',
    trendText: 'text-sky-700',
    bar: 'bg-sky-500',
  },
  green: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-200',
    iconColor: 'text-emerald-700',
    trendBg: 'bg-emerald-200',
    trendText: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
  orange: {
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-200',
    iconColor: 'text-orange-700',
    trendBg: 'bg-orange-200',
    trendText: 'text-orange-700',
    bar: 'bg-orange-500',
  },
  purple: {
    bg: 'bg-violet-50',
    iconBg: 'bg-violet-200',
    iconColor: 'text-violet-700',
    trendBg: 'bg-violet-200',
    trendText: 'text-violet-700',
    bar: 'bg-violet-500',
  },
  red: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-200',
    iconColor: 'text-red-700',
    trendBg: 'bg-red-200',
    trendText: 'text-red-700',
    bar: 'bg-red-500',
  },
}

function AnimatedCounter({ end, duration = 1200 }: { end: number; duration?: number }) {
  // Initialize with final value for SSR - prevents hydration mismatch
  const [count, setCount] = useState(end)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          // Disconnect after triggering animation
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) {
      // Reset to 0 when becoming visible to start animation
      setCount(0)
      return
    }

    let startTime: number | null = null
    const animateCount = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(end * easeOutQuart))

      if (progress < 1) {
        requestAnimationFrame(animateCount)
      } else {
        setCount(end)
      }
    }

    requestAnimationFrame(animateCount)
  }, [isVisible, end, duration])

  return <span ref={ref} suppressHydrationWarning>{count.toLocaleString('id-ID')}</span>
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color = 'slate',
  delay = 0,
}: StatsCardProps) {
  const styles = colorStyles[color]

  return (
    <Card
      className={'card-3d ' + styles.bg + ' opacity-0 animate-fade-in'}
      style={{ animationDelay: delay + 'ms' }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={'p-2.5 rounded-lg shadow-inner-soft ' + styles.iconBg}>
            <Icon className={'h-5 w-5 ' + styles.iconColor} />
          </div>
          {trend && (
            <div className={'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shadow-sm ' + (trend.isPositive ? styles.trendBg + ' ' + styles.trendText : 'bg-red-100 text-red-700')}>
              <span>{trend.isPositive ? '+' : ''}</span>
              <span>{trend.value}%</span>
            </div>
          )}
        </div>

        <div className="mb-2">
          <div className={'text-3xl font-bold ' + styles.iconColor}>
            <AnimatedCounter end={value} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>

        {/* Solid bar - no gradient */}
        <div className={'absolute bottom-0 left-0 h-1 ' + styles.bar} style={{ width: '40%' }} />
      </CardContent>
    </Card>
  )
}

interface StatsGridProps {
  stats: Array<{
    title: string
    value: number
    icon: LucideIcon
    description?: string
    trend?: {
      value: number
      isPositive: boolean
    }
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'slate'
  }>
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatsCard key={stat.title} {...stat} delay={index * 75} />
      ))}
    </div>
  )
}
