'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, CreditCard, ArrowRight, FileText, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { usePaymentSelection } from '@/contexts/PaymentSelectionContext'
import { getJenjangCategory } from '@/lib/kta-upgrade'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableHeader } from '@/components/ui/sortable-header'
interface KTARequest {
  id: string
  idIzin: string
  nama: string
  nik: string
  jenjang: string
  jabatanKerja: string
  status: string
  hargaFinal: number
  createdAt: string
  isUpgrade?: boolean
  upgradeFromKtaId?: string | null
  hargaUpgrade?: number | null
}

interface BulkPayment {
  id: string
  invoiceNumber: string
  totalJumlah: number
  totalNominal: number
  status: 'PENDING' | 'PAID' | 'VERIFIED' | 'REJECTED'
  createdAt: string
  verifiedAt?: string
  payments: {
    id: string
    ktaRequest: {
      id: string
      idIzin: string
      nama: string
      jenjang: string
    }
  }[]
}

export default function DaerahPaymentPage() {
  const { session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { selectedRequests, addRequest, removeRequest, clearSelection } = usePaymentSelection()
  const [ktaRequests, setKtaRequests] = useState<KTARequest[]>([])
  const [bulkPayments, setBulkPayments] = useState<BulkPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  const { sort, toggleSort, applyClientSort } = useTableSort('createdAt', 'desc')

  // Track if we've already shown the toast
  const hasShownToast = useRef(false)
  // Track if we've done initial fetch
  const hasInitialFetch = useRef(false)
  // Store all KTA data for client-side filtering
  const [allKtaRequests, setAllKtaRequests] = useState<KTARequest[]>([])

  // Check for payment success params and show toast (only once)
  useEffect(() => {
    if (hasShownToast.current) return

    const paymentSuccess = searchParams.get('payment_success')
    const count = searchParams.get('count')
    const uploadSuccess = searchParams.get('upload_success')

    if (paymentSuccess === 'true' && count) {
      hasShownToast.current = true
      toast({
        variant: 'success',
        title: 'Pembayaran Berhasil',
        description: `Pembayaran untuk ${count} KTA telah berhasil diupload. Invoice akan diverifikasi oleh Pusat.`,
      })

      // Clear URL params
      router.replace('/dashboard/payments/daerah', { scroll: false })
    } else if (uploadSuccess === 'true') {
      hasShownToast.current = true
      toast({
        variant: 'success',
        title: 'Upload Berhasil',
        description: 'Bukti pembayaran berhasil diupload. Invoice akan diverifikasi oleh Pusat.',
      })

      // Clear URL params
      router.replace('/dashboard/payments/daerah', { scroll: false })
    }
  }, [searchParams, toast, router])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Initial fetch - only run once on mount
  useEffect(() => {
    if (!hasInitialFetch.current) {
      fetchUnpaidKTAs()
      fetchBulkPayments()
      hasInitialFetch.current = true
    }
  }, [])

  // Client-side filter when search changes
  useEffect(() => {
    if (hasInitialFetch.current) {
      // Filter KTA requests client-side
      if (!debouncedSearchTerm) {
        setKtaRequests(allKtaRequests)
      } else {
        const searchLower = debouncedSearchTerm.toLowerCase()
        const filtered = allKtaRequests.filter(kta =>
          kta.nama.toLowerCase().includes(searchLower) ||
          (kta.idIzin || '').toLowerCase().includes(searchLower) ||
          kta.nik.toLowerCase().includes(searchLower)
        )
        setKtaRequests(filtered)
      }
    }
  }, [debouncedSearchTerm, allKtaRequests])

  const fetchUnpaidKTAs = async () => {
    try {
      setLoading(true)

      // Only fetch KTAs that need payment (DRAFT, FETCHED_FROM_SIKI, EDITED, WAITING_PAYMENT, UPGRADE_PENDING)
      const params = new URLSearchParams()
      const payableStatuses = ['DRAFT']
      payableStatuses.forEach(status => params.append('status', status))

      const response = await fetch(`/api/kta/list?${params}`)
      const data = await response.json()

      if (data.success) {
        // Filter out already paid ones and show only those needing payment
        const payable = data.data.filter((kta: KTARequest) =>
          !["WAITING_PAYMENT", "APPROVED_BY_PUSAT", "READY_TO_PRINT", "PRINTED", "READY_FOR_PUSAT"].includes(kta.status)
        )
        setAllKtaRequests(payable)
        setKtaRequests(payable)
      }
    } catch (error) {
      console.error('Error fetching KTA requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBulkPayments = async () => {
    try {
      const response = await fetch('/api/payments/bulk')
      const data = await response.json()

      if (data.success) {
        setBulkPayments(data.data)
      }
    } catch (error) {
      console.error('Error fetching bulk payments:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-800 border-gray-200' },
      FETCHED_FROM_SIKI: { label: 'Diambil dari SIKI', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      EDITED: { label: 'Edited', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      WAITING_PAYMENT: { label: 'Menunggu Pembayaran', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      UPGRADE_PENDING: { label: 'Upgrade - Menunggu Pembayaran', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    }
    return badges[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
  }

  const getBulkPaymentStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      PENDING: {
        label: 'Menunggu Pembayaran',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: <Clock className="h-3 w-3" />
      },
      PAID: {
        label: 'Sudah Dibayar',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <CheckCircle className="h-3 w-3" />
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

  const handleSelectRequest = (request: KTARequest) => {
    const isSelected = selectedRequests.find(r => r.id === request.id)
    if (isSelected) {
      removeRequest(request.id)
    } else {
      addRequest({
        id: request.id,
        idIzin: request.idIzin,
        nama: request.nama,
        nik: request.nik,
        jenjang: request.jenjang,
        hargaFinal: request.hargaFinal
      })
    }
  }

  const handleSelectAll = () => {
    const allSelected = ktaRequests.every(req =>
      selectedRequests.find(r => r.id === req.id)
    )

    if (allSelected) {
      clearSelection()
    } else {
      // Clear first, then add all
      clearSelection()
      ktaRequests.forEach(req => {
        addRequest({
          id: req.id,
          idIzin: req.idIzin,
          nama: req.nama,
          nik: req.nik,
          jenjang: req.jenjang,
          hargaFinal: req.hargaFinal
        })
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data..." />
      </div>
    )
  }

  const selectedCount = selectedRequests.length

  // Filter bulk payments by search term (search names in invoice)
  const filteredBulkPayments = bulkPayments.filter(payment => {
    if (!debouncedSearchTerm) return true
    const searchLower = debouncedSearchTerm.toLowerCase()
    return payment.payments.some(p =>
      p.ktaRequest.nama.toLowerCase().includes(searchLower) ||
      (p.ktaRequest.idIzin || '').toLowerCase().includes(searchLower)
    )
  })

  const sortedBulkPayments = applyClientSort(filteredBulkPayments, (p: BulkPayment) => {
    switch (sort.key) {
      case 'invoiceNumber': return p.invoiceNumber
      case 'totalJumlah': return p.totalJumlah
      case 'totalNominal': return p.totalNominal
      case 'status': return p.status
      default: return p.createdAt
    }
  })

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="animate-slide-up-stagger stagger-1">
          <h1 className="text-2xl font-semibold text-slate-900">Pembayaran KTA</h1>
          <p className="text-slate-500 text-sm">Pilih KTA yang ingin Anda bayar</p>
        </div>

      {/* Info Guide */}
      <Card className="bg-blue-50 border-blue-200 animate-slide-up-stagger stagger-2">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <div className="text-blue-600 mt-0.5">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Informasi</h3>
              <p className="text-sm text-blue-800 leading-relaxed">
                Pilih KTA yang akan dibayar dengan mencentang data, kemudian klik <strong>"Lanjut Pembayaran"</strong> dan <strong>"Buat Invoice"</strong>. Invoice yang telah dibuat akan muncul pada tabel <strong>"Invoice Menunggu Pembayaran"</strong> klik baris tabel tersebut untuk melanjutkan proses pembayaran. Setelah pembayaran selesai, KTA akan tersedia di halaman <strong>"Data KTA"</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="card-3d animate-slide-up-stagger stagger-3">
        <CardContent className="pt-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Cari berdasarkan nama, ID Izin, atau NIK..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* KTA List */}
      <Card className="card-3d animate-slide-up-stagger stagger-4">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Daftar KTA yang Perlu Dibayar
            </CardTitle>
            {ktaRequests.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-sm"
              >
                {selectedCount === ktaRequests.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {ktaRequests.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Tidak ada KTA yang perlu dibayar</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ktaRequests.map((request) => {
                const isSelected = selectedRequests.find(r => r.id === request.id)
                const badge = getStatusBadge(request.status)

                return (
                  <div
                    key={request.id}
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                    onClick={() => handleSelectRequest(request)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => handleSelectRequest(request)}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-medium text-slate-900">{request.nama}</p>
                          <Badge className={badge.className}>{badge.label}</Badge>
                          {request.isUpgrade && (
                            <Badge className="bg-purple-50 text-purple-700 border-purple-300 flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Upgrade
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="font-mono">{request.idIzin}</span>
                          <span>•</span>
                          <span className="font-mono">{request.nik}</span>
                          <span>•</span>
                          <span>Kualifikasi {getJenjangCategory(request.jenjang)}</span>
                          {request.isUpgrade && request.upgradeFromKtaId && (
                            <>
                              <span>•</span>
                              <span className="text-purple-600 font-medium">Upgrade dari KTA sebelumnya</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          Rp {request.hargaFinal?.toLocaleString('id-ID') || '-'}
                        </p>
                        {request.isUpgrade && request.hargaUpgrade && (
                          <p className="text-xs text-purple-600">
                            Biaya Upgrade: Rp {request.hargaUpgrade.toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Payments / Invoice Table */}
      <Card className="card-3d animate-slide-up-stagger stagger-5">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-slate-700" />
            Invoice Menunggu Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBulkPayments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {debouncedSearchTerm ? 'Tidak ada invoice yang cocok dengan pencarian' : 'Belum ada invoice pembayaran'}
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
                    <SortableHeader label="Tanggal" sortKey="createdAt" sort={sort} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedBulkPayments.map((payment) => {
                    const statusBadge = getBulkPaymentStatusBadge(payment.status)
                    return (
                      <tr
                        key={payment.id}
                        className="border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/payments/daerah/invoice/${payment.id}`)}
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{payment.invoiceNumber}</p>
                          <p className="text-xs text-slate-500">
                            {payment.payments.map(p => p.ktaRequest.nama).join(', ')}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            {payment.totalJumlah} KTA
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">
                            Rp {payment.totalNominal.toLocaleString('id-ID')}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusBadge.className}>
                            {statusBadge.icon}
                            <span className="ml-1">{statusBadge.label}</span>
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {new Date(payment.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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

      {/* Spacer for floating bar */}
      {selectedCount > 0 && <div className="h-20" />}
    </div>
    </>
  )
}
