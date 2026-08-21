'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft, Loader2, Download, FileSpreadsheet } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import { safeInvoiceFilename } from '@/lib/utils'

interface BulkPaymentDetail {
  id: string
  invoiceNumber: string
  totalJumlah: number
  totalNominal: number
  buktiPembayaranUrl: string
  status: 'PENDING' | 'PAID' | 'VERIFIED' | 'REJECTED'
  createdAt: string
  verifiedAt?: string
  daerah: {
    namaDaerah: string
    kodeDaerah: string
    diskonPersen?: number | null
  }
  submittedByUser: {
    name: string
  }
  verifiedByUser?: {
    name: string
  }
  payments: Array<{
    id: string
    ktaRequest: {
      id: string
      idIzin: string
      nama: string
      nik: string
      jabatanKerja: string
      jenjang: string
      hargaBase?: number | null
    }
  }>
}

export default function PusatInvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [payment, setPayment] = useState<BulkPaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)

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
        setPayment(data.data)
      } else {
        setError(data.error || 'Gagal memuat detail invoice')
      }
    } catch (error) {
      setError('Terjadi kesalahan saat memuat data')
      console.error('Fetch invoice error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!payment) return

    try {
      setDownloading(true)
      const response = await fetch(`/api/payments/invoice/${payment.id}/pdf`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeInvoiceFilename(payment.invoiceNumber)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Download Gagal',
        description: 'Gagal mendownload PDF invoice.',
      })
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadExcel = async () => {
    if (!payment) return

    try {
      setDownloadingExcel(true)
      const response = await fetch(`/api/payments/invoice/${payment.id}/excel`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error('Failed to generate Excel')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeInvoiceFilename(payment.invoiceNumber)}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Download Gagal',
        description: 'Gagal mendownload Excel invoice.',
      })
    } finally {
      setDownloadingExcel(false)
    }
  }

  const handleVerify = async () => {
    if (!payment) return

    setVerifying(true)
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkPaymentId: payment.id,
          approved: true
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Verifikasi Berhasil',
          description: 'Pembayaran telah berhasil diverifikasi.',
        })
        fetchInvoice(payment.id)
      } else {
        toast({
          variant: 'destructive',
          title: 'Verifikasi Gagal',
          description: result.error || 'Gagal memverifikasi pembayaran.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Verifikasi Gagal',
        description: 'Terjadi kesalahan saat memverifikasi pembayaran.',
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleReject = async () => {
    if (!payment || !rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Alasan Ditolak Diperlukan',
        description: 'Silakan masukkan alasan penolakan.',
      })
      return
    }

    setRejecting(true)
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkPaymentId: payment.id,
          approved: false,
          reason: rejectionReason
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Pembayaran Ditolak',
          description: 'Pembayaran telah berhasil ditolak.',
        })
        fetchInvoice(payment.id)
        setRejectionReason('')
      } else {
        toast({
          variant: 'destructive',
          title: 'Penolakan Gagal',
          description: result.error || 'Gagal menolak pembayaran.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Penolakan Gagal',
        description: 'Terjadi kesalahan saat menolak pembayaran.',
      })
    } finally {
      setRejecting(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-orange-100 text-orange-800',
      PAID: 'bg-blue-100 text-blue-800',
      VERIFIED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulseLogo text="Memuat detail pembayaran..." />
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Data tidak ditemukan'}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard/payments/pusat/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Daftar Invoice
        </Button>
      </div>
    )
  }

  const canVerify = payment.status === 'PAID'
  const canReject = payment.status === 'PAID' || payment.status === 'PENDING'

  return (
    <>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up-stagger stagger-1">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/payments/pusat/invoices')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <h1 className="text-3xl font-bold">Detail Pembayaran</h1>
            </div>
            <p className="text-gray-600">{payment.invoiceNumber}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3 animate-slide-up-stagger stagger-2">
          <Badge className={getStatusColor(payment.status)}>
            {payment.status === 'PENDING' && (
              <>
                <Clock className="h-4 w-4 mr-1" />
                Menunggu Pembayaran
              </>
            )}
            {payment.status === 'PAID' && (
              <>
                <Clock className="h-4 w-4 mr-1" />
                Sudah Dibayar
              </>
            )}
            {payment.status === 'VERIFIED' && (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Terkonfirmasi
              </>
            )}
            {payment.status === 'REJECTED' && (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                Ditolak
              </>
            )}
          </Badge>
          <span className="text-sm text-gray-600">
            {new Date(payment.createdAt).toLocaleString('id-ID')}
          </span>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Invoice PDF */}
          <Card className="card-3d animate-slide-up-stagger stagger-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Invoice</CardTitle>
                {(payment.status === 'PAID' || payment.status === 'VERIFIED') && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleDownloadPDF}
                      disabled={downloading}
                      variant="outline"
                      size="sm"
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleDownloadExcel}
                      disabled={downloadingExcel}
                      variant="outline"
                      size="sm"
                    >
                      {downloadingExcel ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Excel
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-slate-50">
                <iframe
                  src={`/api/payments/invoice/${payment.id}/pdf`}
                  className="w-full h-[600px]"
                  title="Invoice PDF"
                />
              </div>
            </CardContent>
          </Card>

          {/* Right: Data Pembayaran */}
          <Card className="card-3d animate-slide-up-stagger stagger-4">
            <CardHeader>
              <CardTitle>Informasi Pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Daerah</span>
                  <span className="font-medium">
                    {payment.daerah.namaDaerah} ({payment.daerah.kodeDaerah})
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Jumlah KTA</span>
                  <span className="font-medium">{payment.totalJumlah} KTA</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Total Pembayaran</span>
                  <span className="font-bold text-green-600">
                    Rp {payment.totalNominal.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Diajukan oleh</span>
                  <span className="font-medium">{payment.submittedByUser.name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Tanggal Pengajuan</span>
                  <span className="font-medium">
                    {new Date(payment.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>
                {payment.verifiedByUser && (
                  <>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Dikonfirmasi oleh</span>
                      <span className="font-medium">{payment.verifiedByUser.name}</span>
                    </div>
                    {payment.verifiedAt && (
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Tanggal Konfirmasi</span>
                        <span className="font-medium">
                          {new Date(payment.verifiedAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daftar KTA */}
        <Card className="card-3d animate-slide-up-stagger stagger-5">
          <CardHeader>
            <CardTitle>Daftar KTA ({payment.payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">ID Izin</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Nama</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">NIK</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Kualifikasi</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Jabatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payment.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{p.ktaRequest.idIzin}</td>
                      <td className="px-4 py-3 text-slate-700">{p.ktaRequest.nama}</td>
                      <td className="px-4 py-3 text-slate-700">{p.ktaRequest.nik}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {p.ktaRequest.jenjang}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.ktaRequest.jabatanKerja}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Bar for Actions */}
      {(canVerify || canReject) && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <Card className="rounded-none shadow-2xl animate-slide-up">
            <CardContent className="py-4 px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-lg font-semibold text-slate-900">Konfirmasi Pembayaran</p>
                  <p className="text-sm text-slate-500">
                    {payment.totalJumlah} KTA • Rp {payment.totalNominal.toLocaleString('id-ID')}
                  </p>
                </div>

                {/* Reject Section */}
                {canReject && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Alasan penolakan..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      disabled={rejecting}
                      className="w-64"
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
                          <XCircle className="h-4 w-4 mr-2" />
                          Tolak
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Verify Button */}
                {canVerify && (
                  <Button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="bg-emerald-600 hover:bg-emerald-700 px-8"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Verifikasi
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
