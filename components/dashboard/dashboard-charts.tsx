'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { useState } from 'react'

interface StatusData {
  name: string
  value: number
  color: string
}

interface MonthlyData {
  month: string
  total: number
  approved: number
  pending: number
}

interface DailyData {
  date: string
  count: number
}

export interface RegionTimeData {
  date: string
  [key: string]: string | number
}

interface ChartProps {
  className?: string
}

// Gatensi Brand Colors - Navy Blue Theme
const LSP_COLORS = {
  blue: '#1e40af',
  blueDark: '#1e3a8a',
  blueLight: '#dbeafe',
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue800: '#1e40af',
  blue900: '#1e3a8a',
  red: '#dc2626',
  green: '#22c55e',
  orange: '#f59446',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
  yellow: '#eab308',
  indigo: '#6366f1',
}

// Color palette for regions - using Gatensi brand colors as base
const REGION_COLORS = [
  LSP_COLORS.blue,
  LSP_COLORS.red,
  LSP_COLORS.green,
  LSP_COLORS.orange,
  LSP_COLORS.purple,
  LSP_COLORS.cyan,
  LSP_COLORS.indigo,
  LSP_COLORS.yellow,
]

// Custom tooltip styling following the new design
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
        <p className="text-slate-500 text-xs mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// NEW STYLE: Modern Revenue Chart Design
export function DailySubmissionChart({
  data,
  onPeriodChange,
  currentPeriod = 'week',
  className
}: {
  data: DailyData[]
  onPeriodChange?: (period: TimePeriod) => void
  currentPeriod?: TimePeriod
  className?: string
} & ChartProps) {
  // Calculate totals
  const totalCount = data.reduce((sum, item) => sum + item.count, 0)

  // Calculate growth (compare first half vs second half)
  const midpoint = Math.floor(data.length / 2)
  const firstHalf = data.slice(0, midpoint).reduce((sum, item) => sum + item.count, 0)
  const secondHalf = data.slice(midpoint).reduce((sum, item) => sum + item.count, 0)
  const growth = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0

  return (
    <div className={'bg-white rounded-2xl p-6 shadow-sm border border-slate-200 ' + (className || '')}>
      {/* Title */}
      <h3 className="text-lg font-semibold text-brand-blue-900 mb-6">Pengajuan KTA Per Hari</h3>

      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        {/* Metrics */}
        <div className="flex gap-8">
          <div>
            <p className="text-3xl font-bold text-brand-blue-900">{totalCount}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Pengajuan</p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-brand-blue-900">{data.length > 0 ? data[data.length - 1].count : 0}</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Hari Ini</p>
              {growth > 0 && (
                <span className="text-xs text-emerald-600 font-medium">
                  ↑{growth}% dari periode lalu
                </span>
              )}
              {growth < 0 && (
                <span className="text-xs text-red-600 font-medium">
                  ↓{Math.abs(growth)}% dari periode lalu
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Period Filters */}
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((period) => (
            <button
              key={period}
              onClick={() => onPeriodChange?.(period)}
              className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
                currentPeriod === period
                  ? 'bg-brand-blue-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {period === 'week' ? 'Minggu' : period === 'month' ? 'Bulan' : 'Tahun'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Section */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            key={`daily-${currentPeriod}`}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#1e40af"
              strokeWidth={2.5}
              dot={{ fill: '#1e40af', r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#1e3a8a', stroke: '#1e40af', strokeWidth: 2 }}
              name="Pengajuan"
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Period Labels */}
      {data.length > 0 && (
        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate-400 uppercase">{data[0].date}</span>
          <span className="text-xs text-brand-blue-800 uppercase font-medium">{data[data.length - 1].date}</span>
        </div>
      )}
    </div>
  )
}

// NEW STYLE: Region Chart
export function RegionSubmissionChart({
  data,
  regions = [],
  onPeriodChange,
  currentPeriod = 'week',
  className
}: {
  data: RegionTimeData[]
  regions?: string[]
  onPeriodChange?: (period: TimePeriod) => void
  currentPeriod?: TimePeriod
  className?: string
} & ChartProps) {
  // Calculate total submissions
  const totalSubmissions = data.reduce((sum, item) => {
    let count = 0
    regions.forEach(region => {
      count += typeof item[region] === 'number' ? item[region] : 0
    })
    return sum + count
  }, 0)

  return (
    <div className={'bg-white rounded-2xl p-6 shadow-sm border border-slate-200 ' + (className || '')}>
      {/* Title */}
      <h3 className="text-lg font-semibold text-brand-blue-900 mb-6">Pengajuan KTA Per Daerah</h3>

      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        {/* Metrics */}
        <div className="flex gap-8">
          <div>
            <p className="text-3xl font-bold text-brand-blue-900">{totalSubmissions}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Pengajuan</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-blue-900">{regions.length}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Daerah Aktif</p>
          </div>
        </div>

        {/* Period Filters */}
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((period) => (
            <button
              key={period}
              onClick={() => onPeriodChange?.(period)}
              className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
                currentPeriod === period
                  ? 'bg-brand-blue-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {period === 'week' ? 'Minggu' : period === 'month' ? 'Bulan' : 'Tahun'}
            </button>
          ))}
        </div>
      </div>

      {/* Region Legend */}
      

      {/* Chart Section */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            key={`region-${currentPeriod}`}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {regions.map((region, index) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLORS[index % REGION_COLORS.length]}
                strokeWidth={2}
                dot={{ fill: REGION_COLORS[index % REGION_COLORS.length], r: 3, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#1e3a8a', strokeWidth: 2 }}
                name={region}
                animationBegin={index * 100}
                animationDuration={800}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {regions.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {regions.map((region, index) => (
            <div key={region} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: REGION_COLORS[index % REGION_COLORS.length] }}
              />
              <span className="text-xs text-slate-600">{region}</span>
            </div>
          ))}
        </div>
      )}

      {/* Period Labels */}
      {data.length > 0 && (
        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate-400 uppercase">{data[0].date}</span>
          <span className="text-xs text-brand-blue-800 uppercase font-medium">{data[data.length - 1].date}</span>
        </div>
      )}
    </div>
  )
}

// Comparison Card - Keep original design but update colors
interface DaerahComparisonData {
  thisMonthCount: number
  lastMonthCount: number
  growthPercentage: number
  totalPrinted: number
}

export function DaerahComparisonCard({ data, className }: { data: DaerahComparisonData } & ChartProps) {
  const isPositive = data.growthPercentage >= 0

  return (
    <Card className={'card-3d animate-slide-up ' + (className || '')}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Perbandingan Bulanan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-600 mb-1">Bulan Ini</div>
              <div className="text-3xl font-bold text-brand-blue-900 count-up">{data.thisMonthCount}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-600 mb-1">Bulan Lalu</div>
              <div className="text-3xl font-bold text-brand-blue-900 count-up">{data.lastMonthCount}</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-600 mb-1">Pertumbuhan</div>
                <div className={'text-2xl font-bold ' + (isPositive ? 'text-green-600' : 'text-red-600')}>
                  {isPositive ? '+' : ''}{data.growthPercentage.toFixed(1)}%
                </div>
              </div>
              <div className={'w-12 h-12 rounded-full flex items-center justify-center ' + (isPositive ? 'bg-green-100' : 'bg-red-100')}>
                <svg
                  className={'w-6 h-6 ' + (isPositive ? 'text-green-600' : 'text-red-600')}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isPositive ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  )}
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-brand-blue-800 to-brand-blue-900 rounded-xl p-5 text-white shadow-lg">
            <div className="text-xs text-blue-200 mb-1">Total KTA Dicetak</div>
            <div className="text-4xl font-bold text-white count-up">{data.totalPrinted}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// NEW STYLE: Daerah Printed Chart
export function DaerahPrintedChart({
  data,
  onPeriodChange,
  currentPeriod = 'month',
  className
}: {
  data: DailyData[]
  onPeriodChange?: (period: TimePeriod) => void
  currentPeriod?: TimePeriod
  className?: string
} & ChartProps) {
  // Calculate totals
  const totalPrinted = data.reduce((sum, item) => sum + item.count, 0)

  // Calculate growth
  const midpoint = Math.floor(data.length / 2)
  const firstHalf = data.slice(0, midpoint).reduce((sum, item) => sum + item.count, 0)
  const secondHalf = data.slice(midpoint).reduce((sum, item) => sum + item.count, 0)
  const growth = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0

  return (
    <div className={'bg-white rounded-2xl p-6 shadow-sm border border-slate-200 ' + (className || '')}>
      {/* Title */}
      <h3 className="text-lg font-semibold text-brand-blue-900 mb-6">KTA Dicetak Per Periode</h3>

      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        {/* Metrics */}
        <div className="flex gap-8">
          <div>
            <p className="text-3xl font-bold text-brand-blue-900">{totalPrinted}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Dicetak</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-blue-900">{data.length > 0 ? data[data.length - 1].count : 0}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Terakhir</p>
              {growth > 0 && (
                <span className="text-xs text-emerald-600 font-medium">
                  ↑{growth}% MOM
                </span>
              )}
              {growth < 0 && (
                <span className="text-xs text-red-600 font-medium">
                  ↓{Math.abs(growth)}% MOM
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Period Filters */}
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((period) => (
            <button
              key={period}
              onClick={() => onPeriodChange?.(period)}
              className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
                currentPeriod === period
                  ? 'bg-brand-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {period === 'week' ? 'Minggu' : period === 'month' ? 'Bulan' : 'Tahun'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Section */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            key={`daerah-${currentPeriod}`}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid rgba(226, 232, 240, 1)',
                borderRadius: '12px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '12px 16px',
              }}
              labelFormatter={(label) => `Tanggal: ${label}`}
              formatter={(value) => [value, 'KTA Dicetak']}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#dc2626"
              strokeWidth={2.5}
              dot={{ fill: '#dc2626', r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#b91c1c', stroke: '#dc2626', strokeWidth: 2 }}
              name="KTA Dicetak"
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Period Labels */}
      {data.length > 0 && (
        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate-400 uppercase">{data[0].date}</span>
          <span className="text-xs text-brand-red-600 uppercase font-medium">{data[data.length - 1].date}</span>
        </div>
      )}
    </div>
  )
}

// Keep other legacy charts for now
export function StatusChart({ data, className }: { data: StatusData[] } & ChartProps) {
  return (
    <Card className={'card-3d ' + (className || '')}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Distribusi Status KTA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={'cell-' + index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid rgba(226, 232, 240, 1)',
                borderRadius: '12px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '12px 16px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-slate-600">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export type TimePeriod = 'week' | 'month' | 'year'
