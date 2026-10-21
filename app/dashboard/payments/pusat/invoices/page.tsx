'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, FileText, Search, RotateCcw, Loader2, Printer } from 'lucide-react'
import Link from 'next/link'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableHeader } from '@/components/ui/sortable-header'
import { getPaymentStatusBadge as getStatusBadge } from '@/lib/status-badges'
import { formatDateTimeWibShort } from '@/lib/utils'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/components/ui/use-toast'

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

interface DaerahOption {
  id: string
  namaDaerah: string
  kodeDaerah: string
}

export default function PusatInvoicesHistoryPage() {
  const router = useRouter()
  const { session } = useSession()
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<BulkPayment[]>([])
  const [daftarDaerah, setDaftarDaerah] = useState<DaerahOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [daerahKode, setDaerahKode] = useState('all')

  // BPP (role PUSAT) cuma melihat invoice daerah Pusat — tanpa pilihan filter
  // daerah. ADMIN/KEUANGAN boleh lintas daerah.
  const bisaPilihDaerah = session?.user?.role === 'ADMIN' || session?.user?.role === 'KEUANGAN'

  // BPP (PUSAT) dan BPD (DAERAH) yang bayar sendiri; ADMIN/KEUANGAN cuma verifikasi.
  const bolehBayarLangsung = session?.user?.role === 'PUSAT' || session?.user?.role === 'DAERAH'

  const { sort, toggleSort, applyClientSort } = useTableSort('createdAt', 'desc')

  useEffect(() => {
    if (!bisaPilihDaerah) return

    const fetchDaerah = async () => {
      try {
        const response = await fetch('/api/payments/bulk?daftarDaerah=true')
        const data = await response.json()
        if (data.success) setDaftarDaerah(data.data)
      } catch (error) {
        console.error('Error fetching daerah:', error)
      }
    }

    fetchDaerah()
  }, [bisaPilihDaerah])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ all: 'true', pusat: 'true' })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (daerahKode !== 'all') params.append('daerahKode', daerahKode)

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
  }, [startDate, endDate, daerahKode])

  // Buka PDF invoice di tab baru, langsung munculin dialog print browser.
  //
  // PDF-nya beda origin (route API), jadi nggak bisa dipanggil print() dari
  // halaman ini. Yang dilempar ke tab baru adalah halaman kecil di origin yang
  // sama: dia embed PDF-nya terus manggil print() di iframe-nya sendiri.
  const bukaDanPrint = (invoiceId: string) => {
    const tab = window.open('', '_blank')
    if (!tab) {
      toast({
        variant: 'destructive',
        title: 'Popup diblokir',
        description: 'Izinkan popup buat situs ini lalu coba lagi.',
      })
      return
    }
    // noopener nggak dipakai di sini karena kita butuh akses ke dokumen tab.
    tab.location.href = `/dashboard/payments/pusat/invoices/print/${invoiceId}`
  }

  const resetFilter = () => {
    setStartDate('')
    setEndDate('')
    setDaerahKode('all')
  }

  const adaFilter = !!(startDate || endDate || daerahKode !== 'all')

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

  // Loading pertama tetap pakai skeleton penuh; ganti filter cukup spinner
  // kecil di judul tabel supaya halaman nggak berkedip.
  if (loading && invoices.length === 0) {
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

      {/* Filter Tanggal & Daerah */}
      <Card className="card-3d animate-slide-up-stagger stagger-2">
        <CardContent className="pt-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <Label htmlFor="search-invoice" className="text-xs text-slate-500">Cari</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="search-invoice"
                  placeholder="Cari nomor invoice..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
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
            {bisaPilihDaerah && (
              <div>
                <Label className="text-xs text-slate-500">Daerah</Label>
                <Select value={daerahKode} onValueChange={setDaerahKode}>
                  <SelectTrigger className="h-9 w-52">
                    <SelectValue placeholder="Semua daerah" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Daerah</SelectItem>
                    {daftarDaerah.map((d) => (
                      <SelectItem key={d.id} value={d.kodeDaerah}>
                        {d.namaDaerah}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
      <Card className="card-3d animate-slide-up-stagger stagger-2">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-slate-700" />
            Daftar Invoice
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
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
                {adaFilter ? 'Tidak ada invoice pada filter ini' : 'Belum ada invoice pembayaran'}
              </p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Tidak ada invoice yang cocok dengan &quot;{search}&quot;</p>
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
                    <th className="py-3 px-4 text-xs font-semibold text-slate-600 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInvoices.map((invoice) => {
                    const statusBadge = getStatusBadge(invoice.status)
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() =>
                          router.push(
                            // Belum dibayar + yang buka BPP/BPD: langsung ke halaman bayar.
                            // ADMIN/KEUANGAN tetap ke detail, mereka nggak membayar.
                            invoice.status === 'PENDING' && bolehBayarLangsung
                              ? `/dashboard/payments/daerah/invoice/${invoice.id}`
                              : `/dashboard/payments/pusat/invoice/${invoice.id}`
                          )
                        }
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
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2"
                            onClick={(e) => {
                              // Jangan ikut buka halaman detail (row onClick).
                              e.stopPropagation()
                              bukaDanPrint(invoice.id)
                            }}
                            title="Buka PDF invoice di tab baru dan langsung print"
                          >
                            <Printer className="h-4 w-4" />
                            Print
                          </Button>
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
