'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, Clock, CheckCircle, XCircle, Search } from 'lucide-react'
import Link from 'next/link'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableHeader } from '@/components/ui/sortable-header'

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

export default function PusatInvoicesHistoryPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<BulkPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const { sort, toggleSort, applyClientSort } = useTableSort('createdAt', 'desc')

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/payments/bulk?all=true&pusat=true')
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      PENDING: {
        label: 'Menunggu Pembayaran',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: <Clock className="h-3 w-3" />
      },
      PAID: {
        label: 'Menunggu Verifikasi',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <Clock className="h-3 w-3" />
      },
      VERIFIED: {
        label: 'Terverifikasi',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: <CheckCircle className="h-3 w-3" />
      },
      REJECTED: {
        label: 'Ditolak',
        className: 'bg-red-100 text-red-800 border-red-200',
        icon: <XCircle className="h-3 w-3" />
      },
    }
    return badges[status] || { label: status, className: 'bg-gray-100 text-gray-800', icon: null }
  }

  // Filter invoices based on search term
  const filteredInvoices = invoices.filter((invoice) =>
    invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    invoice.id.toLowerCase().includes(search.toLowerCase())
  )

  const sortedInvoices = applyClientSort(filteredInvoices, (inv: BulkPayment) => {
    switch (sort.key) {
      case 'invoiceNumber': return inv.invoiceNumber
      case 'totalJumlah': return inv.totalJumlah
      case 'totalNominal': return inv.totalNominal
      case 'status': return inv.status
      case 'verifiedAt': return inv.verifiedAt
      default: return inv.createdAt
    }
  })

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
      <div className="flex items-center gap-4 animate-slide-up-stagger stagger-1">
        <Link href="/dashboard/payments/pusat">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Riwayat Invoice Pembayaran (Pusat)</h1>
          <p className="text-slate-500 text-sm">Semua invoice pembayaran KTA</p>
        </div>
      </div>

      {/* Invoices Table */}
      <Card className="card-3d animate-slide-up-stagger stagger-2">
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-slate-700" />
              Daftar Invoice
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari invoice..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Belum ada invoice pembayaran</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Tidak ada invoice yang cocok dengan "{search}"</p>
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
                        onClick={() => router.push(`/dashboard/payments/pusat/invoice/${invoice.id}`)}
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
                          {new Date(invoice.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {invoice.verifiedAt ? (
                            new Date(invoice.verifiedAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
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
