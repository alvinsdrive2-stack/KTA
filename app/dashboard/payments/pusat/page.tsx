'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, CreditCard, FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import { usePaymentSelection } from '@/contexts/PaymentSelectionContext'

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

export default function PusatPaymentPage() {
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

  // Track if we've already shown the toast
  const hasShownToast = useRef(false)

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
        description: `Pembayaran untuk ${count} KTA telah berhasil diupload.`,
      })

      // Clear URL params
      router.replace('/dashboard/payments/pusat', { scroll: false })
    } else if (uploadSuccess === 'true') {
      hasShownToast.current = true
      toast({
        variant: 'success',
        title: 'Upload Berhasil',
        description: 'Bukti pembayaran berhasil diupload.',
      })

      // Clear URL params
      router.replace('/dashboard/payments/pusat', { scroll: false })
    }
  }, [searchParams, toast, router])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchUnpaidKTAs()
    fetchBulkPayments()
  }, [debouncedSearchTerm])

  const fetchUnpaidKTAs = async () => {
    try {
      setLoading(true)

      // Only fetch KTAs that need payment (DRAFT, FETCHED_FROM_SIKI, EDITED, WAITING_PAYMENT)
      const params = new URLSearchParams()
      const payableStatuses = ['DRAFT', 'FETCHED_FROM_SIKI', 'EDITED', 'WAITING_PAYMENT']
      payableStatuses.forEach(status => params.append('status', status))
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)

      const response = await fetch(`/api/kta/list?${params}`)
      const data = await response.json()

      if (data.success) {
        // Filter out already paid ones and show only those needing payment
        const payable = data.data.filter((kta: KTARequest) =>
          !['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED', 'READY_FOR_PUSAT'].includes(kta.status)
        )
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
      const response = await fetch('/api/payments/bulk?pusat=true')
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
    }
    return badges[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
  }

  const getBulkPaymentStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      PENDING: {
        label: 'Menunggu Konfirmasi',
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

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="animate-slide-up-stagger stagger-1">
          <h1 className="text-2xl font-semibold text-slate-900">Pembayaran KTA (Pusat)</h1>
          <p className="text-slate-500 text-sm">Pilih KTA yang ingin Anda bayar</p>
        </div>

      {/* Search */}
      <Card className="card-3d animate-slide-up-stagger stagger-2">
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
      <Card className="card-3d animate-slide-up-stagger stagger-3">
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
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="font-mono">{request.idIzin}</span>
                          <span>•</span>
                          <span className="font-mono">{request.nik}</span>
                          <span>•</span>
                          <span>Jenjang {request.jenjang}</span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          Rp {request.hargaFinal?.toLocaleString('id-ID') || '-'}
                        </p>
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
      <Card className="card-3d animate-slide-up-stagger stagger-4">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-slate-700" />
            Invoice Menunggu Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bulkPayments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Belum ada invoice pembayaran</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">No. Invoice</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">Jumlah KTA</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">Total Nominal</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPayments.map((payment) => {
                    const statusBadge = getBulkPaymentStatusBadge(payment.status)
                    return (
                      <tr
                        key={payment.id}
                        className="border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/payments/pusat/invoice/${payment.id}`)}
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{payment.invoiceNumber}</p>
                          <p className="text-xs text-slate-500">ID: {payment.id.slice(0, 8)}</p>
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
