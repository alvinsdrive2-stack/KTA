'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { FileText, CreditCard, CheckCircle, Clock, Eye, UserCheck, RefreshCw } from 'lucide-react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { StatsGrid } from '@/components/dashboard/stats-card'
import { TableCard, TableRow, StatusBadge } from '@/components/dashboard/table-card'
import { PulseLogo } from '@/components/ui/loading-spinner'
import {
  DailySubmissionChart,
  RegionSubmissionChart,
  TimePeriod,
  RegionTimeData,
  DaerahComparisonCard,
  DaerahPrintedChart
} from '@/components/dashboard/dashboard-charts'
import { useRenderCount } from '@/hooks/useRenderCount'

interface KTARequest {
  id: string
  idIzin: string
  nama: string
  nik: string
  jabatanKerja: string
  status: string
  createdAt: string
  daerah?: {
    namaDaerah: string
  }
}

interface DailyData {
  date: string
  count: number
}

interface DaerahComparisonData {
  last6Months: number
  previous6Months: number
  growthPercentage: number
  totalPrinted: number
}

const CACHE_KEY = 'dashboard_cache'
const CACHE_DURATION = 5 * 60 * 1000

interface DashboardCache {
  data: KTARequest[]
  stats: {
    totalKTA: number
    draftKTA: number
    waitingPayment: number
    waitingApproval: number
    approvedKTA: number
    printedKTA: number
  }
  timestamp: number
}

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession()
  const userRole = session?.user?.role as string
  const sessionLoading = sessionStatus === 'loading'
  useRenderCount('DashboardPage')

  const [ktaRequests, setKtaRequests] = useState<KTARequest[]>([])
  const [stats, setStats] = useState({
    totalKTA: 0,
    draftKTA: 0,
    waitingPayment: 0,
    waitingApproval: 0,
    approvedKTA: 0,
    printedKTA: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // PUSAT/ADMIN charts
  const [dailySubmissions, setDailySubmissions] = useState<DailyData[]>([])
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week')
  const [loadingDailyChart, setLoadingDailyChart] = useState(true)

  const [regionSubmissions, setRegionSubmissions] = useState<RegionTimeData[]>([])
  const [regionList, setRegionList] = useState<string[]>([])
  const [regionTimePeriod, setRegionTimePeriod] = useState<TimePeriod>('week')
  const [loadingRegionChart, setLoadingRegionChart] = useState(true)

  // DAERAH charts
  const [daerahPrintedData, setDaerahPrintedData] = useState<DailyData[]>([])
  const [daerahPeriod, setDaerahPeriod] = useState<TimePeriod>('month')
  const [loadingDaerahChart, setLoadingDaerahChart] = useState(true)
  const [daerahComparison, setDaerahComparison] = useState<DaerahComparisonData>({
    last6Months: 0,
    previous6Months: 0,
    growthPercentage: 0,
    totalPrinted: 0,
  })

  const hasFetchedRef = useRef(false)
  const [hasFetchedCharts, setHasFetchedCharts] = useState(false)

  const displayLimit = 5
  const displayRequests = ktaRequests.slice(0, displayLimit)
  const hasMore = ktaRequests.length > displayLimit

  const calculateStats = (data: KTARequest[]) => ({
    totalKTA: data.length,
    draftKTA: data.filter((kta) => kta.status === 'DRAFT').length,
    waitingPayment: data.filter((kta) => kta.status === 'WAITING_PAYMENT').length,
    waitingApproval: data.filter((kta) =>
      kta.status === 'READY_FOR_PUSAT' || kta.status === 'WAITING_PAYMENT'
    ).length,
    approvedKTA: data.filter((kta) =>
      kta.status === 'APPROVED_BY_PUSAT' || kta.status === 'READY_TO_PRINT' || kta.status === 'PRINTED'
    ).length,
    printedKTA: data.filter((kta) => kta.status === 'PRINTED').length,
  })

  // Load from cache with useState lazy initializer (runs once on mount)
  const [cachedData, setCachedData] = useState<DashboardCache | null>(() => {
    // Only access localStorage in state initializer (client-only)
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null
      const parsed = JSON.parse(cached) as DashboardCache
      const now = Date.now()
      if (now - parsed.timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY)
        return null
      }
      return parsed
    } catch {
      return null
    }
  })

  const fetchDashboardData = async (useCache = true) => {
    // Use cached data from state if available
    if (useCache && !hasFetchedRef.current && cachedData) {
      setKtaRequests(cachedData.data)
      setStats(cachedData.stats)
      setLoading(false)
      hasFetchedRef.current = true
      setCachedData(null) // Clear cache after using
      fetchDashboardData(false).catch(() => {})
      // Don't call fetchRoleBasedCharts here - let the useEffect handle it when session is ready
      return
    }

    try {
      setRefreshing(true)
      const ktaResponse = await fetch('/api/kta/list', { cache: 'no-store' })
      const ktaData = await ktaResponse.json()

      if (ktaData.success) {
        const filteredKTA = ktaData.data
        const newStats = calculateStats(filteredKTA)
        setKtaRequests(filteredKTA)
        setStats(newStats)
        // Cache saving is now handled in a separate useEffect
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      hasFetchedRef.current = true
    }
  }

  const fetchRoleBasedCharts = () => {
    if (userRole === 'PUSAT' || userRole === 'ADMIN') {
      fetchDailySubmissions(timePeriod)
      fetchRegionSubmissions(regionTimePeriod)
    } else if (userRole === 'DAERAH') {
      fetchDaerahStats(daerahPeriod)
    }
  }

  // PUSAT/ADMIN chart functions
  const fetchDailySubmissions = async (period: TimePeriod) => {
    try {
      setLoadingDailyChart(true)
      const response = await fetch(`/api/dashboard/daily-submissions?period=${period}`)
      const data = await response.json()

      if (data.success) {
        setDailySubmissions(data.data)
      }
    } catch (error) {
      console.error('Error fetching daily submissions:', error)
    } finally {
      setLoadingDailyChart(false)
    }
  }

  const fetchRegionSubmissions = async (period: TimePeriod) => {
    try {
      setLoadingRegionChart(true)
      const response = await fetch(`/api/dashboard/region-submissions?period=${period}`)
      const data = await response.json()

      if (data.success) {
        setRegionSubmissions(data.data)
        setRegionList(data.regions || [])
      }
    } catch (error) {
      console.error('Error fetching region submissions:', error)
    } finally {
      setLoadingRegionChart(false)
    }
  }

  // DAERAH chart function
  const fetchDaerahStats = async (period: TimePeriod) => {
    try {
      setLoadingDaerahChart(true)
      const response = await fetch(`/api/dashboard/daerah-stats?period=${period}`)
      const data = await response.json()

      if (data.success) {
        setDaerahPrintedData(data.data)
        setDaerahComparison(data.comparison)
      }
    } catch (error) {
      console.error('Error fetching daerah stats:', error)
    } finally {
      setLoadingDaerahChart(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Save data to cache when it changes (client-only operation)
  useEffect(() => {
    if (ktaRequests.length > 0) {
      const newStats = calculateStats(ktaRequests)
      try {
        if (typeof window !== 'undefined') {
          const cache: DashboardCache = { data: ktaRequests, stats: newStats, timestamp: Date.now() }
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
        }
      } catch {
        // Ignore storage errors (quota exceeded, private mode, etc.)
      }
    }
  }, [ktaRequests])

  // Fetch charts when both session and dashboard data are ready
  useEffect(() => {
    if (!sessionLoading && userRole && hasFetchedRef.current && !hasFetchedCharts) {
      fetchRoleBasedCharts()
      setHasFetchedCharts(true)
    }
  }, [sessionLoading, userRole, hasFetchedCharts])

  useEffect(() => {
    if (hasFetchedRef.current && hasFetchedCharts) {
      if (userRole === 'PUSAT' || userRole === 'ADMIN') {
        fetchDailySubmissions(timePeriod)
      } else if (userRole === 'DAERAH') {
        fetchDaerahStats(daerahPeriod)
      }
    }
  }, [timePeriod, daerahPeriod, hasFetchedCharts, userRole])

  useEffect(() => {
    if (hasFetchedRef.current && hasFetchedCharts && (userRole === 'PUSAT' || userRole === 'ADMIN')) {
      fetchRegionSubmissions(regionTimePeriod)
    }
  }, [regionTimePeriod, hasFetchedCharts, userRole])

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'> = {
      DRAFT: 'pending',
      FETCHED_FROM_SIKI: 'processing',
      EDITED: 'pending',
      WAITING_PAYMENT: 'pending',
      READY_FOR_PUSAT: 'processing',
      APPROVED_BY_PUSAT: 'approved',
      READY_TO_PRINT: 'processing',
      PRINTED: 'completed',
      REJECTED: 'rejected',
    }
    return statusMap[status] || 'pending'
  }

  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      DRAFT: 'Draft',
      FETCHED_FROM_SIKI: 'Diambil dari SIKI',
      EDITED: 'Diedit',
      WAITING_PAYMENT: 'Menunggu Konfirmasi',
      READY_FOR_PUSAT: 'Siap Verifikasi Pusat',
      APPROVED_BY_PUSAT: 'Disetujui Pusat',
      READY_TO_PRINT: 'Siap Cetak',
      PRINTED: 'Sudah Dicetak',
      REJECTED: 'Ditolak',
    }
    return labelMap[status] || status.replace(/_/g, ' ')
  }

  const handleRefresh = () => {
    // Clear cache state and localStorage
    setCachedData(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY)
    }
    hasFetchedRef.current = false
    setHasFetchedCharts(false)
    fetchDashboardData(false)
  }

  if (loading || sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat dashboard..." />
      </div>
    )
  }

  const statsData = [
    { title: 'Total KTA', value: stats.totalKTA, icon: FileText, description: 'Total permohonan KTA', color: 'slate' as const },
    { title: 'Menunggu Pembayaran', value: stats.waitingPayment, icon: Clock, description: 'Belum melakukan pembayaran', color: 'orange' as const },
    { title: 'Disetujui', value: stats.approvedKTA, icon: CheckCircle, description: stats.printedKTA + ' sudah dicetak', color: 'green' as const },
    { title: 'Menunggu Persetujuan', value: stats.waitingApproval, icon: UserCheck, description: 'Sedang dalam proses verifikasi', color: 'blue' as const },
  ]

  const isPusatOrAdmin = userRole === 'PUSAT' || userRole === 'ADMIN'
  const isDaerah = userRole === 'DAERAH'

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      <div
        className="relative overflow-hidden rounded-2xl p-8 shadow-2xl animate-slide-up-stagger stagger-1"
        style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)'
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
              <h1 className="text-3xl font-bold text-white mb-2">
                {isDaerah ? 'Dashboard Daerah' : isPusatOrAdmin ? 'Dashboard Pusat' : 'Dashboard'}
              </h1>
              <p className="text-white/90">
                {isDaerah
                  ? 'Kelola dan pantau KTA di daerah Anda'
                  : 'Pantau dan kelola seluruh aktivitas KTA'}
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

      {/* Stats Grid */}
      <div className="animate-slide-up-stagger stagger-2">
        <StatsGrid stats={statsData} />
      </div>

      {/* Charts Section - Role Based */}
      {isPusatOrAdmin && (
        <div className="grid lg:grid-cols-2 gap-5 animate-slide-up-stagger stagger-3">
          {/* Daily Submission Chart */}
          {loadingDailyChart ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center min-h-[350px]">
              <PulseLogo text="Memuat chart..." />
            </div>
          ) : (
            <DailySubmissionChart
              data={dailySubmissions}
              currentPeriod={timePeriod}
              onPeriodChange={setTimePeriod}
            />
          )}

          {/* Region Submission Chart */}
          {loadingRegionChart ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center min-h-[350px]">
              <PulseLogo text="Memuat chart..." />
            </div>
          ) : (
            <RegionSubmissionChart
              data={regionSubmissions}
              regions={regionList}
              currentPeriod={regionTimePeriod}
              onPeriodChange={setRegionTimePeriod}
            />
          )}
        </div>
      )}

      {isDaerah && (
        <div className="grid lg:grid-cols-3 gap-5 animate-slide-up-stagger stagger-3">
          {loadingDaerahChart ? (
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center min-h-[350px]">
              <PulseLogo text="Memuat chart..." />
            </div>
          ) : (
            <div className="lg:col-span-2">
              <DaerahPrintedChart
                data={daerahPrintedData}
                currentPeriod={daerahPeriod}
                onPeriodChange={setDaerahPeriod}
              />
            </div>
          )}
          <div>
            <DaerahComparisonCard data={daerahComparison} />
          </div>
        </div>
      )}

      {/* Recent KTA Requests */}
      <div className="animate-slide-up-stagger stagger-4">
        <TableCard
          title="Permohonan Terbaru"
        icon={FileText}
        description={'Menampilkan ' + displayRequests.length + ' dari ' + ktaRequests.length + ' permohonan'}
        action={hasMore ? { label: 'Lihat Semua', href: '/dashboard/kta' } : undefined}
        delay={400}
      >
        {displayRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-3 shadow-inner">
              <FileText className="h-6 w-6 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">Belum ada permohonan KTA</h3>
            <p className="text-slate-500 mb-4 max-w-md text-sm">Mulai dengan membuat permohonan KTA baru</p>
            <Button asChild className="bg-slate-800 text-white hover:bg-slate-700 shadow-md" size="default">
              <Link href="/dashboard/kta/apply">
                <FileText className="mr-2 h-4 w-4" />
                Buat Permohonan Baru
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">Nama Anggota</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">ID Izin</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">NIK</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">Jabatan</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayRequests.map((request, index) => (
                  <TableRow key={request.id} hover className="opacity-0 animate-fade-in" style={{ animationDelay: (450 + index * 50) + 'ms' }}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gatensi-blue flex items-center justify-center text-white font-medium text-xs shadow-md">
                          {request.nama.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{request.nama}</div>
                          {request.daerah?.namaDaerah && <div className="text-xs text-slate-500">{request.daerah.namaDaerah}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-slate-600">{request.idIzin}</td>
                    <td className="text-sm text-slate-600 font-mono">{request.nik}</td>
                    <td className="text-sm text-slate-600">{request.jabatanKerja}</td>
                    <td>
                      <StatusBadge status={getStatusBadge(request.status)} label={getStatusLabel(request.status)} />
                    </td>
                    <td className="text-right">
                      <Link href={'/dashboard/kta/' + request.id}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 hover:text-slate-700">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </TableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4 animate-slide-up-stagger stagger-5">
        <Link href="/dashboard/kta/fetch-siki" className="card-3d bg-white p-5 group">
          <div className="w-11 h-11 rounded-lg bg-gatensi-blueLight flex items-center justify-center mb-3 group-hover:bg-gatensi-blueLight/80 transition-colors">
            <FileText className="h-5 w-5 text-gatensi-blue" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1 text-sm">Ambil Data SIKI</h3>
          <p className="text-xs text-slate-500">Verifikasi data anggota melalui SIKI PU</p>
        </Link>

        <Link href="/dashboard/permohonan" className="card-3d bg-white p-5 group">
          <div className="w-11 h-11 rounded-lg bg-gatensi-redLight flex items-center justify-center mb-3 group-hover:bg-gatensi-redLight/80 transition-colors">
            <CreditCard className="h-5 w-5 text-gatensi-red" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1 text-sm">Kelola KTA</h3>
          <p className="text-xs text-slate-500">Kelola permohonan KTA</p>
        </Link>

        <Link href="/dashboard/payments" className="card-3d bg-white p-5 group">
          <div className="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
            <CheckCircle className="h-5 w-5 text-green-700" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1 text-sm">Konfirmasi Pembayaran</h3>
          <p className="text-xs text-slate-500">Verifikasi pembayaran masuk</p>
        </Link>
      </div>
    </div>
  )
}
