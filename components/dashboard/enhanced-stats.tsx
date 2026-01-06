'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface EnhancedStatsCardProps {
  title: string
  value: number
  icon: LucideIcon
  description?: string
  trend?: {
    value: number
    isPositive: boolean
    label?: string
  }
  target?: {
    current: number
    total: number
    label: string
  }
  sparkline?: number[]
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'slate'
  delay?: number
}

const colorStyles = {
  slate: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-200',
    iconColor: 'text-slate-700',
    trendUp: 'text-emerald-600',
    trendDown: 'text-red-600',
    trendNeutral: 'text-slate-600',
    sparkline: 'stroke-slate-400',
    progressBg: 'bg-slate-200',
    progressFill: 'bg-slate-500',
  },
  blue: {
    bg: 'bg-sky-50',
    iconBg: 'bg-sky-200',
    iconColor: 'text-sky-700',
    trendUp: 'text-emerald-600',
    trendDown: 'text-red-600',
    trendNeutral: 'text-slate-600',
    sparkline: 'stroke-sky-400',
    progressBg: 'bg-sky-200',
    progressFill: 'bg-sky-500',
  },
  green: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-200',
    iconColor: 'text-emerald-700',
    trendUp: 'text-emerald-600',
    trendDown: 'text-red-600',
    trendNeutral: 'text-slate-600',
    sparkline: 'stroke-emerald-400',
    progressBg: 'bg-emerald-200',
    progressFill: 'bg-emerald-500',
  },
  orange: {
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-200',
    iconColor: 'text-orange-700',
    trendUp: 'text-emerald-600',
    trendDown: 'text-red-600',
    trendNeutral: 'text-slate-600',
    sparkline: 'stroke-orange-400',
    progressBg: 'bg-orange-200',
    progressFill: 'bg-orange-500',
  },
  purple: {
    bg: 'bg-violet-50',
    iconBg: 'bg-violet-200',
    iconColor: 'text-violet-700',
    trendUp: 'text-emerald-600',
    trendDown: 'text-red-600',
    trendNeutral: 'text-slate-600',
    sparkline: 'stroke-violet-400',
    progressBg: 'bg-violet-200',
    progressFill: 'bg-violet-500',
  },
}

function AnimatedCounter({ end, duration = 1200 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
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
    if (!isVisible) return

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

  return <span ref={ref}>{count.toLocaleString('id-ID')}</span>
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 80
  const height = 30
  const padding = 2

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
    </svg>
  )
}

function ProgressRing({ progress, size = 40, strokeWidth = 4, color }: {
  progress: number
  size?: number
  strokeWidth?: number
  color: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-200"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={color}
      />
    </svg>
  )
}

export function EnhancedStatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  target,
  sparkline,
  color = 'slate',
  delay = 0,
}: EnhancedStatsCardProps) {
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

          <div className="flex items-center gap-2">
            {/* Trend Badge */}
            {trend && (
              <div className={'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shadow-sm ' +
                (trend.isPositive ? 'bg-emerald-100 text-emerald-700' : trend.value === 0 ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-700')
              }>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trend.value === 0 ? (
                  <Minus className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              </div>
            )}

            {/* Sparkline */}
            {sparkline && sparkline.length > 1 && (
              <div className="opacity-60">
                <Sparkline data={sparkline} color={styles.sparkline} />
              </div>
            )}
          </div>
        </div>

        {/* Value */}
        <div className="mb-2">
          <div className={'text-3xl font-bold ' + styles.iconColor}>
            <AnimatedCounter end={value} />
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-3">
          <h3 className="text-sm font-medium text-slate-700">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          {trend && trend.label && (
            <p className="text-xs text-slate-400 mt-1">{trend.label}</p>
          )}
        </div>

        {/* Target Progress */}
        {target && (
          <div className="pt-3 border-t border-slate-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-600">{target.label}</span>
              <span className="text-xs font-semibold text-slate-700">
                {target.current} / {target.total}
              </span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden bg-slate-200">
              <div
                className={'absolute top-0 left-0 h-full rounded-full transition-all duration-500 ' + styles.progressFill}
                style={{ width: `${Math.min((target.current / target.total) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className={'absolute bottom-0 left-0 h-1 ' + styles.progressFill} style={{ width: '40%' }} />
      </CardContent>
    </Card>
  )
}

interface EnhancedStatsGridProps {
  stats: Array<{
    title: string
    value: number
    icon: LucideIcon
    description?: string
    trend?: {
      value: number
      isPositive: boolean
      label?: string
    }
    target?: {
      current: number
      total: number
      label: string
    }
    sparkline?: number[]
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'slate'
  }>
}

export function EnhancedStatsGrid({ stats }: EnhancedStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <EnhancedStatsCard key={stat.title} {...stat} delay={index * 75} />
      ))}
    </div>
  )
}
