'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon, Users, TrendingUp, TrendingDown } from 'lucide-react'
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
      className={'card-3d ' + styles.bg + ' opacity-0 animate-fade-in h-full'}
      style={{ animationDelay: delay + 'ms' }}
    >
      <CardContent className="p-5 h-full flex flex-col">
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

interface TotalAnggotaCardProps {
  totalAhli: number
  totalTeknisi: number
  totalOperator: number
  delay?: number
}

export function TotalAnggotaCard({ totalAhli, totalTeknisi, totalOperator, delay = 0 }: TotalAnggotaCardProps) {
  const total = totalAhli + totalTeknisi + totalOperator

  // Dynamic breakdown items - automatically adjusts to any number of items
  const breakdownItems = [
    { label: 'Ahli', value: totalAhli, icon: '/kualifikasi/ahli.png' },
    { label: 'Teknisi/Analis', value: totalTeknisi, icon: '/kualifikasi/teknisi.png' },
    { label: 'Operator', value: totalOperator, icon: '/kualifikasi/operator.png' },
  ]

  return (
    <Card className="card-3d bg-slate-50 opacity-0 animate-fade-in relative h-full" style={{ animationDelay: delay + 'ms' }}>
      <CardContent className="p-5 h-full flex flex-col">
        {/* Main Content: Left Total, Right Breakdown */}
        <div className="flex items-center justify-between gap-3">
          {/* Left Side: Total */}
          <div className="flex-1">
            <div className="p-2.5 rounded-lg shadow-inner-soft bg-slate-200 w-fit mb-3">
              <Users className="h-5 w-5 text-slate-700" />
            </div>
            <div className="text-3xl font-bold text-slate-700 mb-2">
              <AnimatedCounter end={total} />
            </div>
            <h3 className="text-sm font-medium text-slate-700">Total Anggota</h3>
            <p className='text-xs font-medium text-slate-500'>Gabungan Ahli Teknik Nasional Indonesia</p>
          </div>

          {/* Right Side: Breakdown Items (Vertical, auto-flex based on count) */}
          <div className={`flex-1 ${breakdownItems.length === 3 ? 'grid grid-cols-1 gap-2' : 'space-y-2'}`}>
            {breakdownItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-xs text-slate-500">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-slate-700">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Solid bar at bottom */}
        <div className="absolute bottom-0 left-0 h-1 bg-slate-400" style={{ width: '40%' }} />
      </CardContent>
    </Card>
  )
}

interface PertumbuhanAnggotaCardProps {
  growthAhli: number
  growthTeknisi: number
  growthOperator: number
  overallGrowth: number
  delay?: number
}

export function PertumbuhanAnggotaCard({ growthAhli, growthTeknisi, growthOperator, overallGrowth, delay = 0 }: PertumbuhanAnggotaCardProps) {
  // Dynamic breakdown items with growth percentages
  const breakdownItems = [
    { label: 'Ahli', value: growthAhli, icon: '/kualifikasi/ahli.png' },
    { label: 'Teknisi/Analis', value: growthTeknisi, icon: '/kualifikasi/teknisi.png' },
    { label: 'Operator', value: growthOperator, icon: '/kualifikasi/operator.png' },
  ]

  const isPositive = overallGrowth >= 0

  return (
    <Card className="card-3d bg-slate-50 opacity-0 animate-fade-in relative h-full" style={{ animationDelay: delay + 'ms' }}>
      <CardContent className="p-5 h-full flex flex-col">
        {/* Main Content: Left Title, Right Breakdown */}
        <div className="flex items-center justify-between gap-3">
          {/* Left Side: Title with Overall Growth */}
          <div className="flex-1">
            <div className={`p-2.5 rounded-lg shadow-inner-soft w-fit mb-3 ${isPositive ? 'bg-emerald-200' : 'bg-red-200'}`}>
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-emerald-700" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-700" />
              )}
            </div>
            <div className={`text-3xl font-bold mb-2 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{overallGrowth}%
            </div>
            <h3 className="text-sm font-medium text-slate-700">Pertumbuhan Anggota</h3>
            <p className='text-xs font-medium text-slate-500'>Bulan ini vs bulan lalu</p>
          </div>

          {/* Right Side: Breakdown Items with Percentages */}
          <div className={`flex-1 ${breakdownItems.length === 3 ? 'grid grid-cols-1 gap-2' : 'space-y-2'}`}>
            {breakdownItems.map((item) => {
              const itemPositive = item.value >= 0
              return (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" />
                    </div>
                    <span className="text-xs text-slate-500">{item.label}</span>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-bold ${itemPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {itemPositive ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : item.value < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : null}
                    <span>{itemPositive ? '+' : ''}{item.value}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Solid bar at bottom */}
        <div className={`absolute bottom-0 left-0 h-1 ${isPositive ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: '40%' }} />
      </CardContent>
    </Card>
  )
}
