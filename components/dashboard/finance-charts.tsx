'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

// Types
export interface TrendDataPoint {
  date: string
  label: string
  confirmed: number
  pending: number
  total: number
}

export interface RegionFinanceData {
  daerahId: string
  daerahName: string
  confirmedRevenue: number
  pendingRevenue: number
  totalRevenue: number
  totalKTA: number
}

export type PeriodFilter = '1month' | '3months' | '6months' | 'ytd'

// Color constants
const CONFIRMED_COLOR = '#22c55e'
const PENDING_COLOR = '#f59446'

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 1000000000) {
    return `Rp ${(amount / 1000000000).toFixed(1)} Miliar`
  } else if (amount >= 1000000) {
    return `Rp ${(amount / 1000000).toFixed(0)} Juta`
  } else if (amount >= 1000) {
    return `Rp ${(amount / 1000).toFixed(0)} Rb`
  }
  return `Rp ${amount.toLocaleString('id-ID')}`
}

// Custom Tooltip for Line Chart
function CustomLineTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-900 mb-2">{payload[0].payload.label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Custom Tooltip for Pie Chart
function CustomPieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0]
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-900 mb-1">{data.name}</p>
        <p className="text-sm text-slate-600">{formatCurrency(data.value)}</p>
        <p className="text-xs text-slate-500">{data.payload.percentage}%</p>
      </div>
    )
  }
  return null
}

// Revenue Trend Chart Component
export function RevenueTrendChart({
  data,
  period,
  loading = false,
}: {
  data: TrendDataPoint[]
  period: PeriodFilter
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Tren Pendapatan</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-3 text-sm text-slate-500">Memuat chart...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Tren Pendapatan</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-sm text-slate-500">Belum ada data tersedia</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-3d">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">Tren Pendapatan</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => {
                if (value >= 1000000000) return `${(value / 1000000000).toFixed(0)} M`
                if (value >= 1000000) return `${(value / 1000000).toFixed(0)} Jt`
                if (value >= 1000) return `${(value / 1000).toFixed(0)} Rb`
                return value.toString()
              }}
            />
            <Tooltip content={<CustomLineTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="confirmed"
              stroke={CONFIRMED_COLOR}
              strokeWidth={2}
              dot={{ fill: CONFIRMED_COLOR, r: 4 }}
              activeDot={{ r: 6 }}
              name="Terkonfirmasi"
            />
            <Line
              type="monotone"
              dataKey="pending"
              stroke={PENDING_COLOR}
              strokeWidth={2}
              dot={{ fill: PENDING_COLOR, r: 4 }}
              activeDot={{ r: 6 }}
              name="Pending"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Payment Status Pie Chart Component
export function PaymentStatusPieChart({
  confirmedRevenue,
  pendingRevenue,
  loading = false,
}: {
  confirmedRevenue: number
  pendingRevenue: number
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Status Pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-3 text-sm text-slate-500">Memuat chart...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalRevenue = confirmedRevenue + pendingRevenue

  if (totalRevenue === 0) {
    return (
      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Status Pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-sm text-slate-500">Belum ada data tersedia</p>
        </CardContent>
      </Card>
    )
  }

  const confirmedPercentage = ((confirmedRevenue / totalRevenue) * 100).toFixed(1)
  const pendingPercentage = ((pendingRevenue / totalRevenue) * 100).toFixed(1)

  const pieData = [
    {
      name: 'Terkonfirmasi',
      value: confirmedRevenue,
      percentage: confirmedPercentage,
      color: CONFIRMED_COLOR,
    },
    {
      name: 'Pending',
      value: pendingRevenue,
      percentage: pendingPercentage,
      color: PENDING_COLOR,
    },
  ]

  return (
    <Card className="card-3d">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">Status Pembayaran</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              labelLine={false}
              fontSize={12}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CONFIRMED_COLOR }}></div>
              <span className="text-slate-700">Terkonfirmasi</span>
            </div>
            <span className="font-semibold text-slate-900">{formatCurrency(confirmedRevenue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PENDING_COLOR }}></div>
              <span className="text-slate-700">Pending</span>
            </div>
            <span className="font-semibold text-slate-900">{formatCurrency(pendingRevenue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Top Regions Card Component
export function TopRegionsCard({
  data,
  loading = false,
}: {
  data: RegionFinanceData[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Top Daerah</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[300px] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-3 text-sm text-slate-500">Memuat data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Top Daerah</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[300px] flex items-center justify-center">
          <p className="text-sm text-slate-500">Belum ada data tersedia</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-3d">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Top {data.length} Daerah
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">
                  Daerah
                </th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">
                  Terkonfirmasi
                </th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">
                  Pending
                </th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((region, index) => (
                <tr key={region.daerahId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                        {index + 1}
                      </div>
                      <span className="font-medium text-slate-900 text-sm">{region.daerahName}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-sm text-green-600 font-medium">
                    {formatCurrency(region.confirmedRevenue)}
                  </td>
                  <td className="text-right py-3 px-4 text-sm text-orange-600 font-medium">
                    {formatCurrency(region.pendingRevenue)}
                  </td>
                  <td className="text-right py-3 px-4 text-sm font-semibold text-slate-900">
                    {formatCurrency(region.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
