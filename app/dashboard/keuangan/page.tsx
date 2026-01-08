'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { DollarSign, TrendingUp, Clock, RefreshCw, FileText } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { StatsGrid } from '@/components/dashboard/stats-card'
import { PulseLogo } from '@/components/ui/loading-spinner'
import {
  RevenueTrendChart,
  PaymentStatusPieChart,
  TopRegionsCard,
  type PeriodFilter,
  type TrendDataPoint,
  type RegionFinanceData,
} from '@/components/dashboard/finance-charts'

interface FinanceStats {
  confirmedRevenue: number
  pendingRevenue: number
  totalRevenue: number
  previousRevenue: number
  growthRate: number
  totalKTA: number
  avgPerKTA: number
}

const PERIOD_FILTERS: { label: string; value: PeriodFilter }[] = [
  { label: 'Bulan Ini', value: '1month' },
  { label: '3 Bulan', value: '3months' },
  { label: '6 Bulan', value: '6months' },
  { label: 'Tahun Ini', value: 'ytd' },
]

export default function KeuanganPage() {
  const { data: session, status: sessionStatus } = useSession()
  const sessionLoading = sessionStatus === 'loading'
  const userRole = session?.user?.role as string

  // Only PUSAT and ADMIN can access
  const isAuthorized = userRole === 'PUSAT' || userRole === 'ADMIN'

  const [period, setPeriod] = useState<PeriodFilter>('ytd')
  const [stats, setStats] = useState<FinanceStats | null>(null)
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [regionData, setRegionData] = useState<RegionFinanceData[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const hasFetchedRef = useRef(false)

  // Fetch all finance data
  const fetchFinanceData = async (showRefreshLoading = false) => {
    if (showRefreshLoading) {
      setRefreshing(true)
    }

    try {
      const [statsRes, trendRes, regionRes] = await Promise.all([
        fetch(`/api/dashboard/finance/stats?period=${period}`),
        fetch(`/api/dashboard/finance/trend?period=${period}`),
        fetch(`/api/dashboard/finance/by-region?period=${period}&limit=5`),
      ])

      const [statsData, trendDataResult, regionDataResult] = await Promise.all([
        statsRes.json(),
        trendRes.json(),
        regionRes.json(),
      ])

      if (statsData.success) {
        setStats(statsData.data)
      }

      if (trendDataResult.success) {
        setTrendData(trendDataResult.data)
      }

      if (regionDataResult.success) {
        setRegionData(regionDataResult.data)
      }
    } catch (error) {
      console.error('Error fetching finance data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      hasFetchedRef.current = true
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (!sessionLoading && isAuthorized && !hasFetchedRef.current) {
      fetchFinanceData()
    }
  }, [sessionLoading, isAuthorized])

  // Refetch when period changes
  useEffect(() => {
    if (hasFetchedRef.current) {
      fetchFinanceData()
    }
  }, [period])

  const handleRefresh = () => {
    fetchFinanceData(true)
  }

  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    setPeriod(newPeriod)
  }

  // Loading state
  if (loading || sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat dashboard keuangan..." />
      </div>
    )
  }

  // Unauthorized state
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Akses Ditolak</h2>
          <p className="text-slate-500">Halaman ini hanya dapat diakses oleh Pusat dan Admin</p>
        </div>
      </div>
    )
  }

  // Calculate stats for display
  const statsData = stats
    ? [
        {
          title: 'Total Pendapatan',
          value: stats.totalRevenue,
          icon: DollarSign,
          description: `Rp ${(stats.totalRevenue / 1000000).toFixed(0)} Juta`,
          color: 'blue' as const,
        },
        {
          title: 'Pending Revenue',
          value: stats.pendingRevenue,
          icon: Clock,
          description: `Rp ${(stats.pendingRevenue / 1000000).toFixed(0)} Juta`,
          color: 'orange' as const,
        },
        {
          title: 'Growth Rate',
          value: Math.round(stats.growthRate),
          icon: TrendingUp,
          description: `${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate.toFixed(1)}% vs periode lalu`,
          color: stats.growthRate >= 0 ? 'green' : 'red',
        },
        {
          title: 'Rata-rata / KTA',
          value: stats.avgPerKTA,
          icon: FileText,
          description: `Rp ${(stats.avgPerKTA / 1000).toFixed(0)} Rb per KTA`,
          color: 'purple' as const,
        },
      ]
    : []

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      <div
        className="relative overflow-hidden rounded-2xl p-8 shadow-2xl animate-slide-up-stagger stagger-1"
        style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 hero-pattern"></div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Dashboard Keuangan</h1>
              <p className="text-white/90">
                Pantau dan analisis pendapatan LSP Gatensi Karya Konstruksi
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outline"
                className="border-white/40 text-black hover:bg-white/20 hover:text-white backdrop-blur-sm"
                size="sm"
              >
                <RefreshCw className={'mr-2 h-4 w-4 ' + (refreshing ? 'animate-spin' : '')} />
                {refreshing ? 'Memuat...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Period Filter */}
      <div className="animate-slide-up-stagger stagger-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-700 mr-2">Periode:</span>
          {PERIOD_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              onClick={() => handlePeriodChange(filter.value)}
              variant={period === filter.value ? 'default' : 'outline'}
              size="sm"
              className={
                period === filter.value
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="animate-slide-up-stagger stagger-3">
        <StatsGrid stats={statsData} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-5 animate-slide-up-stagger stagger-4">
        <RevenueTrendChart data={trendData} period={period} loading={loading} />
        <PaymentStatusPieChart
          confirmedRevenue={stats?.confirmedRevenue || 0}
          pendingRevenue={stats?.pendingRevenue || 0}
          loading={loading}
        />
      </div>

      {/* Top Regions */}
      <div className="animate-slide-up-stagger stagger-5">
        <TopRegionsCard data={regionData} loading={loading} />
      </div>
    </div>
  )
}
