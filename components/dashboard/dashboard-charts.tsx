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

// LSP Gatensi Brand Colors
const LSP_COLORS = {
  red: '#E31937',
  redDark: '#B91C1C',
  redLight: '#FEE2E2',
  blue: '#1E3A8A',
  blueDark: '#1E40AF',
  blueLight: '#DBEAFE',
  orange: '#f59446',
  green: '#22c55e',
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

// Custom tooltip styling following shadcn/ui patterns
const tooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  border: '1px solid rgba(226, 232, 240, 1)',
  borderRadius: '12px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  padding: '12px 16px',
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const tooltipLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 500,
  marginBottom: '4px',
}

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
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
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

export function MonthlyTrendsChart({ data, className }: { data: MonthlyData[] } & ChartProps) {
  return (
    <Card className={'card-3d ' + (className || '')}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Tren Bulanan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
            <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
            <Legend />
            <Bar dataKey="total" name="Total" fill={LSP_COLORS.blue} radius={[4, 4, 0, 0]} />
            <Bar dataKey="approved" name="Disetujui" fill={LSP_COLORS.green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="pending" name="Pending" fill={LSP_COLORS.orange} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function StatusBreakdownChart({ data, className }: { data: StatusData[] } & ChartProps) {
  return (
    <Card className={'card-3d ' + (className || '')}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Breakdown Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} />
            <XAxis type="number" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
            <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} width={100} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={'cell-' + index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function TrendLineChart({ data, className }: { data: MonthlyData[] } & ChartProps) {
  return (
    <Card className={'card-3d ' + (className || '')}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Tren Pertumbuhan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
            <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
            <Legend />
            <Line
              type="monotone"
              dataKey="total"
              stroke={LSP_COLORS.blue}
              strokeWidth={3}
              dot={{ fill: LSP_COLORS.blue, r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, stroke: LSP_COLORS.blue, strokeWidth: 2, fill: '#fff' }}
              name="Total"
            />
            <Line
              type="monotone"
              dataKey="approved"
              stroke={LSP_COLORS.red}
              strokeWidth={3}
              dot={{ fill: LSP_COLORS.red, r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, stroke: LSP_COLORS.red, strokeWidth: 2, fill: '#fff' }}
              name="Disetujui"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export type TimePeriod = 'week' | 'month' | 'year'

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
  return (
    <Card className={'card-3d animate-slide-up ' + (className || '')}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Pengajuan KTA per Hari
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={currentPeriod === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('week')}
              className={currentPeriod === 'week' ? 'bg-gatensi-blue hover:bg-gatensi-blueDark text-white' : ''}
            >
              Seminggu
            </Button>
            <Button
              variant={currentPeriod === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('month')}
              className={currentPeriod === 'month' ? 'bg-gatensi-blue hover:bg-gatensi-blueDark text-white' : ''}
            >
              Sebulan
            </Button>
            <Button
              variant={currentPeriod === 'year' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('year')}
              className={currentPeriod === 'year' ? 'bg-gatensi-blue hover:bg-gatensi-blueDark text-white' : ''}
            >
              Setahun
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              style={{ fontSize: '12px' }}
              interval="preserveStartEnd"
            />
            <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              labelFormatter={(label) => `Tanggal: ${label}`}
              formatter={(value) => [value, 'Jumlah Pengajuan']}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={LSP_COLORS.blue}
              strokeWidth={3}
              dot={{ fill: LSP_COLORS.blue, r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, stroke: LSP_COLORS.blue, strokeWidth: 3, fill: '#fff' }}
              name="Pengajuan"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

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
  return (
    <Card className={'card-3d animate-slide-up ' + (className || '')}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Pengajuan KTA per Daerah
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={currentPeriod === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('week')}
              className={currentPeriod === 'week' ? 'bg-gatensi-blue hover:bg-gatensi-blueDark text-white' : ''}
            >
              Seminggu
            </Button>
            <Button
              variant={currentPeriod === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('month')}
              className={currentPeriod === 'month' ? 'bg-gatensi-blue hover:bg-gatensi-blueDark text-white' : ''}
            >
              Sebulan
            </Button>
            <Button
              variant={currentPeriod === 'year' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('year')}
              className={currentPeriod === 'year' ? 'bg-gatensi-blue hover:bg-gatensi-blueDark text-white' : ''}
            >
              Setahun
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Region Legend */}
        {regions.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-4">
            {regions.map((region, index) => (
              <div key={region} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: REGION_COLORS[index % REGION_COLORS.length] }}
                />
                <span className="text-sm text-slate-600">{region}</span>
              </div>
            ))}
          </div>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              style={{ fontSize: '12px' }}
              interval="preserveStartEnd"
            />
            <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              labelFormatter={(label) => `Tanggal: ${label}`}
              formatter={(value: number, name: string) => [value, name]}
            />
            <Legend />
            {regions.map((region, index) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLORS[index % REGION_COLORS.length]}
                strokeWidth={2.5}
                dot={{ fill: REGION_COLORS[index % REGION_COLORS.length], r: 3, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, stroke: REGION_COLORS[index % REGION_COLORS.length], strokeWidth: 2, fill: '#fff' }}
                name={region}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface DaerahComparisonData {
  last6Months: number
  previous6Months: number
  growthPercentage: number
  totalPrinted: number
}

export function DaerahComparisonCard({ data, className }: { data: DaerahComparisonData } & ChartProps) {
  const isPositive = data.growthPercentage >= 0

  return (
    <Card className={'card-3d animate-slide-up ' + (className || '')}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Perbandingan 6 Bulan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-600 mb-1">6 Bulan Terakhir</div>
              <div className="text-3xl font-bold text-slate-900 count-up">{data.last6Months}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-600 mb-1">6 Bulan Sebelumnya</div>
              <div className="text-3xl font-bold text-slate-900 count-up">{data.previous6Months}</div>
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

          <div className="bg-gradient-to-br from-gatensi-blue to-gatensi-blueDark rounded-xl p-5 text-white shadow-lg">
            <div className="text-xs text-blue-100 mb-1">Total KTA Dicetak</div>
            <div className="text-4xl font-bold count-up">{data.totalPrinted}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

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
  return (
    <Card className={'card-3d animate-slide-up ' + (className || '')}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg font-semibold text-slate-900">
            KTA Dicetak per Periode
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={currentPeriod === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('week')}
              className={currentPeriod === 'week' ? 'bg-gatensi-red hover:bg-gatensi-redDark text-white' : ''}
            >
              Seminggu
            </Button>
            <Button
              variant={currentPeriod === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('month')}
              className={currentPeriod === 'month' ? 'bg-gatensi-red hover:bg-gatensi-redDark text-white' : ''}
            >
              Sebulan
            </Button>
            <Button
              variant={currentPeriod === 'year' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange?.('year')}
              className={currentPeriod === 'year' ? 'bg-gatensi-red hover:bg-gatensi-redDark text-white' : ''}
            >
              Setahun
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              style={{ fontSize: '12px' }}
              interval="preserveStartEnd"
            />
            <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              labelFormatter={(label) => `Tanggal: ${label}`}
              formatter={(value) => [value, 'KTA Dicetak']}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={LSP_COLORS.red}
              strokeWidth={3}
              dot={{ fill: LSP_COLORS.red, r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, stroke: LSP_COLORS.red, strokeWidth: 3, fill: '#fff' }}
              name="KTA Dicetak"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
