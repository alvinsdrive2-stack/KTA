'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Download, FileText, Loader2, CheckCircle, AlertCircle, UploadCloud, FileImage } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'

interface Payment {
  id: string
  ktaRequest: {
    id: string
    idIzin: string
    nama: string
    nik: string
    jenjang: string
    jabatanKerja: string
    hargaBase: number | null
    hargaFinal: number | null
  }
  jumlah: number
  statusPembayaran: string
}

interface BulkPayment {
  id: string
  invoiceNumber: string
  totalJumlah: number
  totalNominal: number
  buktiPembayaranUrl: string
  status: string
  createdAt: string
  verifiedAt?: string
  daerah: {
    namaDaerah: string
    kodeDaerah: string
    alamat?: string
    telepon?: string
    email?: string
    diskonPersen?: number | null
  }
  submittedByUser: {
    name: string
    email: string
  }
  verifiedByUser?: {
    name: string
  }
  payments: Payment[]
}

export default function PusatInvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [invoice, setInvoice] = useState<BulkPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchInvoice(params.id as string)
    }
  }, [params.id])

  const fetchInvoice = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/payments/invoice/${id}`)
      const data = await response.json()

      if (data.success) {
        setInvoice(data.data)
      } else {
        console.error('Failed to fetch invoice:', data.error)
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!invoice) return

    try {
      setDownloading(true)
      const response = await fetch(`/api/payments/invoice/${invoice.id}/pdf`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PDF:', error)
    } finally {
      setDownloading(false)
    }
  }

  const handleVerify = async () => {
    if (!invoice) return

    setVerifying(true)
    try {
      const response = await fetch(`/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkPaymentId: invoice.id,
          approved: true
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Verifikasi Berhasil',
          description: 'Invoice telah berhasil diverifikasi.',
        })
        fetchInvoice(invoice.id)
      } else {
        toast({
          variant: 'destructive',
          title: 'Verifikasi Gagal',
          description: result.error || 'Gagal memverifikasi invoice.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Verifikasi Gagal',
        description: 'Terjadi kesalahan saat memverifikasi invoice.',
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleReject = async () => {
    if (!invoice || !rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Alasan Ditolak Diperlukan',
        description: 'Silakan masukkan alasan penolakan.',
      })
      return
    }

    setRejecting(true)
    try {
      const response = await fetch(`/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bulkPaymentId: invoice.id,
          approved: false,
          reason: rejectionReason
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Invoice Ditolak',
          description: 'Invoice telah berhasil ditolak.',
        })
        fetchInvoice(invoice.id)
        setRejectionReason('')
      } else {
        toast({
          variant: 'destructive',
          title: 'Penolakan Gagal',
          description: result.error || 'Gagal menolak invoice.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Penolakan Gagal',
        description: 'Terjadi kesalahan saat menolak invoice.',
      })
    } finally {
      setRejecting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      PENDING: { label: 'Menunggu Konfirmasi', className: 'bg-amber-100 text-amber-800 border-amber-200' },
      PAID: { label: 'Sudah Dibayar', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      VERIFIED: { label: 'Terverifikasi', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
      REJECTED: { label: 'Ditolak', className: 'bg-red-100 text-red-800 border-red-200' },
    }
    return badges[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat invoice..." />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Invoice tidak ditemukan</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>
    )
  }

  const statusBadge = getStatusBadge(invoice.status)
  const canVerify = invoice.status === 'PAID'
  const canReject = invoice.status === 'PAID' || invoice.status === 'PENDING'

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <h1 className="text-2xl font-semibold text-slate-900">Detail Invoice</h1>
      </div>

      {/* Invoice Card */}
      <Card className="card-3d">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl text-slate-900">{invoice.invoiceNumber}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                ID: {invoice.id}
              </p>
            </div>
            <Badge className={statusBadge.className}>
              {statusBadge.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Invoice Info */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Dari</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium text-slate-900">{invoice.daerah.namaDaerah}</p>
                <p className="text-slate-600">Kode: {invoice.daerah.kodeDaerah}</p>
                {invoice.daerah.alamat && <p className="text-slate-600">{invoice.daerah.alamat}</p>}
                {invoice.daerah.telepon && <p className="text-slate-600">Telp: {invoice.daerah.telepon}</p>}
                {invoice.daerah.email && <p className="text-slate-600">{invoice.daerah.email}</p>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Detail Invoice</h3>
              <div className="text-sm space-y-1">
                <p className="text-slate-600">
                  Tanggal: {new Date(invoice.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-slate-600">
                  Diajukan oleh: {invoice.submittedByUser.name}
                </p>
                {invoice.verifiedAt && (
                  <p className="text-slate-600">
                    Diverifikasi: {new Date(invoice.verifiedAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                )}
                {invoice.verifiedByUser && (
                  <p className="text-slate-600">
                    Oleh: {invoice.verifiedByUser.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Details Table */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Rincian Pembayaran</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">No</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">ID Izin</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Nama</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">NIK</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Jenjang</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Harga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.payments.map((payment, index) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">{index + 1}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{payment.ktaRequest.idIzin}</td>
                      <td className="py-3 px-4 text-sm text-slate-900">{payment.ktaRequest.nama}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{payment.ktaRequest.nik}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{payment.ktaRequest.jenjang}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-slate-900">
                        {formatCurrency(payment.ktaRequest.hargaBase || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="mb-8 flex gap-4">
            {/* Total Harga */}
            <div className="flex-1 border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Harga</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(invoice.payments.reduce((sum, p) => sum + (p.ktaRequest.hargaBase || 0), 0))}
                </span>
              </div>
            </div>

            {/* Diskon */}
            {(() => {
              const totalHargaBase = invoice.payments.reduce((sum, p) => sum + (p.ktaRequest.hargaBase || 0), 0)
              const diskonAmount = Math.floor(totalHargaBase * (invoice.daerah.diskonPersen || 0) / 100)
              return (
                <div className="flex-1 border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Diskon</span>
                    <span className="text-lg font-bold text-red-600">
                      {diskonAmount > 0 ? `-${formatCurrency(diskonAmount)}` : 'Rp 0'}
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Total Tagihan */}
            <div className="flex-1 border-2 border-blue-600 rounded-lg p-4 bg-blue-50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-blue-900">Total Tagihan</span>
                <span className="text-xl font-bold text-blue-900">
                  {formatCurrency(
                    invoice.payments.reduce((sum, p) => sum + (p.ktaRequest.hargaBase || 0), 0) -
                    Math.floor(invoice.payments.reduce((sum, p) => sum + (p.ktaRequest.hargaBase || 0), 0) * (invoice.daerah.diskonPersen || 0) / 100)
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Proof */}
          {invoice.buktiPembayaranUrl && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Bukti Pembayaran</h3>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative">
                    <img
                      src={invoice.buktiPembayaranUrl}
                      alt="Bukti Pembayaran"
                      className="w-full h-auto"
                    />
                    <a
                      href={invoice.buktiPembayaranUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:text-blue-700 shadow-md transition-colors"
                    >
                      Buka di tab baru
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Action Buttons for Pusat */}
          <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <Button
              onClick={handleDownloadPDF}
              disabled={downloading}
              variant="outline"
              className="flex-1"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoice
                </>
              )}
            </Button>

            {canVerify && (
              <Button
                onClick={handleVerify}
                disabled={verifying}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verifikasi Pembayaran
                  </>
                )}
              </Button>
            )}

            {canReject && (
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Alasan penolakan..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={rejecting}
                />
                <Button
                  onClick={handleReject}
                  disabled={rejecting || !rejectionReason.trim()}
                  variant="destructive"
                >
                  {rejecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Tolak
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
