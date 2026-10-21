'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, FileText, CalendarRange, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableHeader } from '@/components/ui/sortable-header'
import { getPaymentStatusBadge as getStatusBadge } from '@/lib/status-badges'
import { formatDateTimeWibShort } from '@/lib/utils'

interface BulkPayment {
  id: string
  invoiceNumber: string
  totalJumlah: number
  totalNominal: number
  status: 'PENDING' | 'PAID' | 'VERIFIED' | 'REJECTED'
  createdAt: string
  verifiedAt?: string
  rejectionReason?: string
}

export default function InvoicesHistoryPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<BulkPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { sort, toggleSort, applyClientSort } = useTableSort('createdAt', 'desc')

  const sortedInvoices = applyClientSort(invoices, (inv: BulkPayment) => {
    switch (sort.key) {
      case 'invoiceNumber': return inv.invoiceNumber
      case 'totalJumlah': return inv.totalJumlah
      case 'totalNominal': return inv.totalNominal
      case 'status': return inv.status
      case 'verifiedAt': return inv.verifiedAt
      default: return inv.createdAt
    }
  })

  // Filter tanggal jalan di server biar invoice lama nggak ikut ke-download
  // tiap kali rentangnya diganti.
  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ all: 'true' })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/payments/bulk?${params}`)
      const data = await response.json()

      if (data.success) {
        setInvoices(data.data)
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  const resetFilter = () => {
    setStartDate('')
    setEndDate('')
  }

  const adaFilter = !!(startDate || endDate)


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/payments/daerah">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Riwayat Invoice Pembayaran</h1>
          <p className="text-slate-500 text-sm">Semua invoice pembayaran KTA</p>
        </div>
      </div>

      {/* Filter Tanggal */}
      <Card className="card-3d">
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:mr-1">
              <CalendarRange className="h-4 w-4 text-slate-500" />
              Filter
            </div>
            <div>
              <Label htmlFor="start-date" className="text-xs text-slate-500">Tanggal Awal</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-44"
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-xs text-slate-500">Tanggal Akhir</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-44"
              />
            </div>
            {adaFilter && (
              <Button variant="outline" size="sm" onClick={resetFilter} className="h-9 gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="card-3d">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-slate-700" />
            Daftar Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <PulseLogo />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {adaFilter ? 'Tidak ada invoice pada rentang tanggal ini' : 'Belum ada invoice pembayaran'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <SortableHeader label="No. Invoice" sortKey="invoiceNumber" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Jumlah KTA" sortKey="totalJumlah" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Total Nominal" sortKey="totalNominal" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Tanggal Dibuat" sortKey="createdAt" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Tanggal Dibayar" sortKey="verifiedAt" sort={sort} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedInvoices.map((invoice) => {
                    const statusBadge = getStatusBadge(invoice.status)
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/payments/daerah/invoice/${invoice.id}`)}
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{invoice.invoiceNumber}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            {invoice.totalJumlah} KTA
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">
                            Rp {invoice.totalNominal.toLocaleString('id-ID')}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusBadge.className}>
                            {statusBadge.icon}
                            <span className="ml-1">{statusBadge.label}</span>
                          </Badge>
                          {invoice.rejectionReason && (
                            <p className="text-xs text-red-600 mt-1">{invoice.rejectionReason}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDateTimeWibShort(invoice.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {invoice.status !== 'REJECTED' && invoice.verifiedAt ? (
                            formatDateTimeWibShort(invoice.verifiedAt)
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
