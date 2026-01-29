'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Download, FileText, Loader2, CreditCard, CheckCircle2, Clock, Upload, AlertCircle } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import { useMidtransPayment } from '@/hooks/use-midtrans-payment'
import { useSession } from '@/hooks/useSession'

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
    isUpgrade?: boolean
    upgradeFromKtaId?: string | null
    previousKta?: {
      hargaBase: number
      hargaFinal: number
      jenjang: string
    } | null
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

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { session } = useSession()
  const { pay: payWithMidtrans, isLoading: isMidtransLoading } = useMidtransPayment()
  const [invoice, setInvoice] = useState<BulkPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const isPusatOnly = session?.user.role === 'PUSAT' 

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

  const handlePaymentWithMidtrans = async () => {
    if (!invoice) return

    const result = await payWithMidtrans(invoice.id)

    if (result.success) {
      toast({
        variant: 'success',
        title: 'Pembayaran Berhasil!',
        description: 'Terima kasih! Pembayaran Anda telah diterima.',
      })
      fetchInvoice(params.id as string)
    } else if (result.pending) {
      toast({
        variant: 'default',
        title: 'Pembayaran Diproses',
        description: 'Selesaikan pembayaran Anda dalam waktu yang ditentukan.',
      })
    } else if (result.error && result.error !== 'Payment popup closed') {
      toast({
        variant: 'destructive',
        title: 'Pembayaran Gagal',
        description: result.error,
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.match(/image\/(jpeg|jpg|png)/) && !file.type.includes('pdf')) {
        setUploadError('Hanya menerima file JPG, JPEG, PNG, atau PDF')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Ukuran file maksimal 5MB')
        return
      }
      setPaymentProof(file)
      setUploadError(null)
    }
  }

  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentProof || !invoice) {
      setUploadError('Harap pilih file bukti pembayaran')
      return
    }

    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('paymentProof', paymentProof)
    formData.append('bulkPaymentId', invoice.id)

    try {
      const response = await fetch('/api/payments/upload-proof', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Upload Berhasil',
          description: 'Bukti pembayaran telah diupload dan menunggu verifikasi'
        })
        setShowUploadModal(false)
        setPaymentProof(null)
        fetchInvoice(params.id as string)
      } else {
        setUploadError(result.error || 'Gagal mengupload bukti pembayaran')
      }
    } catch (error) {
      setUploadError('Terjadi kesalahan saat mengupload bukti pembayaran')
    } finally {
      setUploading(false)
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
        label: 'Sudah Dibayar',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <CheckCircle2 className="h-3 w-3" />
      },
      VERIFIED: {
        label: 'Terverifikasi',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: <CheckCircle2 className="h-3 w-3" />
      },
      REJECTED: {
        label: 'Ditolak',
        className: 'bg-red-100 text-red-800 border-red-200',
        icon: null
      },
    }
    return badges[status] || { label: status, className: 'bg-gray-100 text-gray-800', icon: null }
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

  // Calculate effective harga for each payment
  const paymentsWithHarga = invoice.payments.map(p => {
    if (p.ktaRequest.isUpgrade && p.ktaRequest.previousKta) {
      return {
        ...p,
        effectiveHarga: (p.ktaRequest.hargaBase || 0) - p.ktaRequest.previousKta.hargaBase
      }
    }
    return {
      ...p,
      effectiveHarga: p.ktaRequest.hargaBase || 0
    }
  })

  const totalHargaBase = paymentsWithHarga.reduce((sum, p) => sum + p.effectiveHarga, 0)
  const diskon = invoice.daerah.diskonPersen || 0
  const diskonAmount = Math.floor(totalHargaBase * diskon / 100)
  const totalTagihan = totalHargaBase - diskonAmount
  const isPending = invoice.status === 'PENDING'

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
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
        <Button
          onClick={handleDownloadPDF}
          disabled={downloading}
          variant="outline"
          className="gap-2"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Invoice
            </>
          )}
        </Button>
      </div>

      {/* Invoice Card */}
      <Card className="card-3d overflow-hidden">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl text-slate-900">{invoice.invoiceNumber}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {new Date(invoice.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
            <Badge className={`${statusBadge.className} flex items-center gap-1.5 px-3 py-1.5`}>
              {statusBadge.icon}
              {statusBadge.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Customer Info */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Ditagihkan Kepada</h3>
            <p className="font-medium text-slate-900">{invoice.daerah.namaDaerah}</p>
            <p className="text-sm text-slate-600">Kode: {invoice.daerah.kodeDaerah}</p>
            {invoice.daerah.alamat && <p className="text-sm text-slate-600">{invoice.daerah.alamat}</p>}
          </div>

          {/* Payment Details Table */}
          <div className="mb-6">
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
                  {paymentsWithHarga.map((payment, index) => {
                    const jenjangText = payment.ktaRequest.isUpgrade
                      ? `${payment.ktaRequest.jenjang} (UPG)`
                      : payment.ktaRequest.jenjang
                    const isUpgrade = payment.ktaRequest.isUpgrade
                    const prevKta = payment.ktaRequest.previousKta
                    return (
                      <tr key={payment.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-600">{index + 1}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">{payment.ktaRequest.idIzin}</td>
                        <td className="py-3 px-4 text-sm text-slate-900">{payment.ktaRequest.nama}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{payment.ktaRequest.nik}</td>
                        <td className="py-3 px-4 text-sm text-slate-900">
                          <span className={isUpgrade ? 'text-purple-700 font-medium' : ''}>
                            {jenjangText}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-slate-900">
                          {formatCurrency(payment.effectiveHarga)}
                          {isUpgrade && prevKta && (
                            <div className="text-xs text-purple-600">
                              {formatCurrency(payment.ktaRequest.hargaBase || 0)} - {formatCurrency(prevKta.hargaBase)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal ({invoice.totalJumlah} KTA)</span>
              <span className="font-medium text-slate-900">{formatCurrency(totalHargaBase)}</span>
            </div>
            {diskonAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Porsi BPD ({diskon}%)</span>
                <span className="font-medium text-red-600">-{formatCurrency(diskonAmount)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between">
                <span className="text-lg font-bold text-slate-900">Total Tagihan</span>
                <span className="text-2xl font-bold text-blue-600">{formatCurrency(totalTagihan)}</span>
              </div>
            </div>
          </div>

          {/* Payment CTA */}
          {isPending ? (
            <div className="space-y-4">
              {/* Midtrans Payment Option */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-full">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Pembayaran Online</h3>
                      <p className="text-sm text-slate-600">Bayar dengan QRIS, GoPay, OVO, Bank Transfer, dll</p>
                    </div>
                  </div>
                  <Button
                    onClick={handlePaymentWithMidtrans}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg w-full sm:w-auto"
                  >
                    {isMidtransLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        Bayar Online
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Manual Payment Option */}
              {isPusatOnly && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-600 rounded-full">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                    
                      <div>
                        <h3 className="font-semibold text-slate-900">Transfer Bank Manual</h3>
                        <p className="text-sm text-slate-600">Upload bukti transfer setelah melakukan pembayaran</p>
                      </div>
                    
                  </div>
                  <Button
                    onClick={() => setShowUploadModal(true)}
                    variant="outline"
                    size="lg"
                    className="border-green-600 text-green-700 hover:bg-green-50 w-full sm:w-auto"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Upload Bukti
                  </Button>
                </div>
              </div>)}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-600 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-900">Pembayaran Berhasil</h3>
                  <p className="text-sm text-green-700">
                    Invoice ini sudah dibayar dan{' '}
                    {invoice.status === 'VERIFIED' ? 'terverifikasi' : 'sedang diverifikasi'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Proof Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadProof} className="space-y-4">
            {invoice && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {formatCurrency(totalTagihan)}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Upload Bukti Transfer
              </label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Format: JPG, JPEG, PNG, PDF (Maks. 5MB)
              </p>
            </div>

            {uploadError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded">
              <p><strong>Rekening Tujuan:</strong></p>
              <p>Bank: BTN KC Jakarta Kuningan</p>
              <p>No. Rekening: 00001.01.30.000986.9</p>
              <p>a.n. Gabungan Ahli Teknik Nasional Indonesia</p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false)
                  setPaymentProof(null)
                  setUploadError(null)
                }}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={uploading || !paymentProof}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Mengupload...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
