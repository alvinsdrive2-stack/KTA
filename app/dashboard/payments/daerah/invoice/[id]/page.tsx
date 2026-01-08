'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Download, FileText, Loader2, Upload, CheckCircle, AlertCircle, UploadCloud, FileImage } from 'lucide-react'
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

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [invoice, setInvoice] = useState<BulkPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const validateAndSetFile = (file: File) => {
    if (!file.type.match(/image\/(jpeg|jpg|png)/) && !file.type.includes('pdf')) {
      setUploadError('Hanya menerima file JPG, JPEG, PNG, atau PDF')
      setPaymentProof(null)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 5MB')
      setPaymentProof(null)
      return
    }

    setPaymentProof(file)
    setUploadError(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleUploadProof = async () => {
    if (!paymentProof) {
      setUploadError('Harap pilih file bukti pembayaran')
      return
    }

    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('paymentProof', paymentProof)
    formData.append('bulkPaymentId', params.id as string)

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
          description: 'Bukti pembayaran berhasil diupload. Invoice akan diverifikasi oleh Pusat.',
        })

        // Refresh invoice data
        fetchInvoice(params.id as string)
        setPaymentProof(null)
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
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Ditagihkan Kepada</h3>
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

          {/* Bank Info */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Informasi Pembayaran</h3>
                <p className="text-sm text-blue-800">
                  Silakan transfer ke rekening: <span className="font-bold">BNI - 1234567890 - a.n. LSP GATENSI NASIONAL</span>
                </p>
              </div>
              <Button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="bg-blue-600 hover:bg-blue-700"
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
            </div>
          </div>

          {/* Upload Bukti Pembayaran Section - Only show if PENDING */}
          {invoice.status === 'PENDING' && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Upload Bukti Pembayaran</h3>
              <Card
                className={`
                  transition-all duration-200
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50/50 shadow-lg scale-[1.02]'
                    : 'border-dashed border-2 border-slate-300 bg-slate-50/30 hover:border-blue-400 hover:bg-slate-50/50'
                  }
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <CardContent className="p-8">
                  <div className="space-y-6">
                    {/* Drop Zone */}
                    <div
                      className={`
                        relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                        ${isDragging
                          ? 'border-blue-500 bg-blue-50/70'
                          : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
                        }
                        ${paymentProof ? 'border-green-400 bg-green-50/30' : ''}
                      `}
                    >
                      {/* Hidden File Input */}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploading}
                      />

                      {/* Icon */}
                      <div className="flex justify-center mb-4">
                        <div
                          className={`
                            p-4 rounded-full transition-all duration-200
                            ${isDragging
                              ? 'bg-blue-500 scale-110'
                              : paymentProof
                                ? 'bg-green-500'
                                : 'bg-slate-200'
                            }
                          `}
                        >
                          {paymentProof ? (
                            <FileImage className="h-8 w-8 text-white" />
                          ) : (
                            <UploadCloud className={`h-8 w-8 ${isDragging ? 'text-white' : 'text-slate-500'}`} />
                          )}
                        </div>
                      </div>

                      {/* Text */}
                      <div className="space-y-2">
                        {paymentProof ? (
                          <>
                            <p className="text-lg font-semibold text-green-700">
                              {paymentProof.name}
                            </p>
                            <p className="text-sm text-green-600">
                              {(paymentProof.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-semibold text-slate-700">
                              {isDragging ? 'Drop file di sini' : 'Drag & Drop bukti pembayaran'}
                            </p>
                            <p className="text-sm text-slate-500">
                              atau klik untuk memilih file
                            </p>
                            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400">
                              <span className="px-2 py-1 bg-slate-200 rounded">JPG</span>
                              <span className="px-2 py-1 bg-slate-200 rounded">PNG</span>
                              <span className="px-2 py-1 bg-slate-200 rounded">PDF</span>
                              <span className="text-slate-400">• Maksimal 5MB</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Error Alert */}
                    {uploadError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-red-800">{uploadError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Upload Button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={handleUploadProof}
                        disabled={!paymentProof || uploading}
                        size="lg"
                        className={`
                          px-8 shadow-lg transition-all duration-200
                          ${paymentProof && !uploading
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-105'
                            : 'bg-blue-600 hover:bg-blue-700'
                          }
                        `}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Mengupload...
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5 mr-2" />
                            Upload Bukti Pembayaran
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
