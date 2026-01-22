'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ArrowLeft, Download, FileText, User, IdCard, Calendar, MapPin, Phone, Mail, Building, Eye, Upload, AlertCircle, Loader2 } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/components/ui/use-toast'

interface KTARequest {
  id: string
  idIzin: string
  nomorKTA: string | null
  nik: string
  nama: string
  jenjang: string
  jabatanKerja: string
  subklasifikasi: string | null
  noTelp: string
  email: string
  alamat: string
  tanggalDaftar: string
  status: string
  kartuGeneratedPath: string | null
  fotoUrl: string | null
  qrCodePath: string | null
  hargaFinal: number
  daerah?: {
    namaDaerah: string
    kodeDaerah: string
    alamat?: string
    telepon?: string
    email?: string
  }
  payments?: Array<{
    bulkPayment?: {
      invoiceNumber: string
      status: string
    }
  }>
}

export default function KTADetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session } = useSession()
  const { toast } = useToast()
  const [kta, setKta] = useState<KTARequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN'

  useEffect(() => {
    if (params.id) {
      fetchKTADetail(params.id as string)
    }
  }, [params.id])

  const fetchKTADetail = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/kta/${id}`)
      const data = await response.json()

      if (data.success) {
        setKta(data.data)
      }
    } catch (error) {
      console.error('Error fetching KTA detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    // Check if KTA is ready for download (status must be READY_TO_PRINT or PRINTED)
    const canDownload = kta?.status === 'READY_TO_PRINT' || kta?.status === 'PRINTED'
    if (!canDownload) {
      alert('PDF belum tersedia. KTA harus sudah diverifikasi dan siap cetak.')
      return
    }

    // Show preview modal first
    setShowPreview(true)
  }

  const confirmDownloadPDF = async () => {
    if (!kta) return

    setDownloading(true)
    setShowPreview(false)
    try {
      const response = await fetch(`/api/kta/${kta.id}/generate-pdf`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KTA-${kta.nomorKTA || kta.nama}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const error = await response.json()
        alert(error.error || 'Gagal mendownload PDF')
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Gagal mendownload PDF')
    } finally {
      setDownloading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.match(/image\/(jpeg|jpg|png)/) && !file.type.includes('pdf')) {
        setPaymentError('Hanya menerima file JPG, JPEG, PNG, atau PDF')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setPaymentError('Ukuran file maksimal 5MB')
        return
      }
      setPaymentProof(file)
      setPaymentError(null)
    }
  }

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentProof || !kta) {
      setPaymentError('Harap pilih file bukti pembayaran')
      return
    }

    setUploading(true)
    setPaymentError(null)

    const formData = new FormData()
    formData.append('paymentProof', paymentProof)
    formData.append('requestIds', JSON.stringify([kta.id]))

    try {
      const response = await fetch('/api/kta/bulk-payment', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Pembayaran Berhasil',
          description: 'Bukti pembayaran telah diupload dan menunggu verifikasi'
        })
        setShowPaymentModal(false)
        setPaymentProof(null)
        // Refresh KTA data
        fetchKTADetail(kta.id)
      } else {
        setPaymentError(result.error || 'Gagal mengupload pembayaran')
      }
    } catch (error) {
      setPaymentError('Terjadi kesalahan saat mengupload pembayaran')
    } finally {
      setUploading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      APPROVED_BY_PUSAT: { label: 'Terverifikasi', className: 'bg-green-100 text-green-800 border-green-200' },
      READY_TO_PRINT: { label: 'Siap Cetak', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
      PRINTED: { label: 'Sudah Cetak', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    }
    return badges[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat detail KTA..." />
      </div>
    )
  }

  if (!kta) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">KTA tidak ditemukan</p>
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

  const statusBadge = getStatusBadge(kta.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 animate-slide-up-stagger stagger-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Detail KTA</h1>
          <p className="text-slate-500 text-sm">Informasi lengkap Kartu Tanda Anggota</p>
        </div>
      </div>

      {/* No. KTA Card */}
      {kta.nomorKTA && (
        <Card className="card-3d bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 animate-slide-up-stagger stagger-2">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-700 text-sm font-medium mb-1">Nomor KTA</p>
                <p className="text-slate-800 text-3xl font-bold font-mono tracking-wider">{kta.nomorKTA}</p>
              </div>
              <IdCard className="h-12 w-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up-stagger stagger-3">
        {/* Personal Information */}
        <Card className="card-3d lg:col-span-2">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-slate-700" />
              Informasi Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Photo */}
              {kta.fotoUrl && (
                <div className="md:col-span-2 flex justify-center">
                  <div className="w-48 h-48 rounded-xl overflow-hidden border-2 border-slate-200 shadow-lg">
                    <img
                      src={kta.fotoUrl}
                      alt={kta.nama}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm text-slate-500">Nama Lengkap</p>
                <p className="text-base font-semibold text-slate-900">{kta.nama}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">NIK</p>
                <p className="text-base font-mono text-slate-900">{kta.nik}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">ID Izin</p>
                <p className="text-base font-mono text-slate-900">{kta.idIzin}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">Jabatan Kerja</p>
                <p className="text-base text-slate-900">{kta.jabatanKerja}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">Subklasifikasi</p>
                <p className="text-base text-slate-900">{kta.subklasifikasi || '-'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">Jenjang</p>
                <Badge variant="outline" className="border-blue-200 text-blue-700">
                  {kta.jenjang}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">No. Telepon</p>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <p className="text-base text-slate-900">{kta.noTelp}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">Email</p>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <p className="text-base text-slate-900">{kta.email}</p>
                </div>
              </div>

              <div className="md:col-span-2 space-y-1">
                <p className="text-sm text-slate-500">Alamat</p>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-slate-400 mt-1" />
                  <p className="text-base text-slate-900">{kta.alamat}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">Tanggal Daftar</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <p className="text-base text-slate-900">
                    {new Date(kta.tanggalDaftar).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500">Status</p>
                <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Side Cards */}
        <div className="space-y-6">
          {/* Daerah Information */}
          <Card className="card-3d">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5 text-slate-700" />
                Informasi Daerah
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-sm text-slate-500">Nama Daerah</p>
                <p className="font-semibold text-slate-900">{kta.daerah?.namaDaerah || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Kode Daerah</p>
                <p className="font-mono text-slate-900">{kta.daerah?.kodeDaerah || '-'}</p>
              </div>
              {kta.daerah?.alamat && (
                <div>
                  <p className="text-sm text-slate-500">Alamat</p>
                  <p className="text-sm text-slate-900">{kta.daerah.alamat}</p>
                </div>
              )}
              {kta.daerah?.telepon && (
                <div>
                  <p className="text-sm text-slate-500">Telepon</p>
                  <p className="text-sm text-slate-900">{kta.daerah.telepon}</p>
                </div>
              )}
              {kta.daerah?.email && (
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="text-sm text-slate-900">{kta.daerah.email}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Info */}
          {kta.payments && kta.payments.length > 0 && (
            <Card className="card-3d">
              <CardHeader className="border-b border-slate-200 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-slate-700" />
                  Informasi Pembayaran
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-sm text-slate-500">No. Invoice</p>
                  <p className="font-mono text-sm text-blue-600">{kta.payments[0].bulkPayment?.invoiceNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status Invoice</p>
                  <Badge className="bg-blue-100 text-blue-800">
                    {kta.payments[0].bulkPayment?.status || '-'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Harga Final</p>
                  <p className="font-semibold text-slate-900">
                    Rp {kta.hargaFinal?.toLocaleString('id-ID') || '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Card - Show if no payment exists */}
          {(!kta.payments || kta.payments.length === 0) && (
            <Card className="card-3d">
              <CardHeader className="border-b border-slate-200 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-slate-700" />
                  Pembayaran
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-500">Harga</p>
                    <p className="font-semibold text-slate-900">
                      Rp {kta.hargaFinal?.toLocaleString('id-ID') || '-'}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Bayar Manual
                  </Button>
                  <p className="text-xs text-slate-500 text-center">
                    Upload bukti pembayaran
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download Card */}
          <Card className="card-3d">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Download className="h-5 w-5 text-slate-700" />
                Download KTA
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {downloading ? (
                  <>Downloading...</>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview & Download
                  </>
                )}
              </Button>
              {(kta.status !== 'READY_TO_PRINT' && kta.status !== 'PRINTED') && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  PDF belum tersedia
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
            <h3 className="text-lg font-semibold">Preview Kartu Tanda Anggota</h3>
            <p className="text-sm text-slate-500">
              {kta?.nama} - {kta?.nomorKTA || 'Pending'}
            </p>
          </div>

          {kta && (
            <div className="w-full h-[70vh] bg-slate-100">
              <iframe
                src={`/api/kta/${kta.id}/generate-pdf`}
                className="w-full h-full border-0"
                title="KTA Preview"
              />
            </div>
          )}

          <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Tutup
            </Button>
            <Button onClick={confirmDownloadPDF} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            {kta && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium">{kta.nama}</p>
                <p className="text-xs text-slate-500">{kta.idIzin}</p>
                <p className="text-lg font-bold text-green-600 mt-2">
                  Rp {kta.hargaFinal?.toLocaleString('id-ID')}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Upload Bukti Pembayaran
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

            {paymentError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{paymentError}</AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded">
              <p><strong>Rekening Tujuan:</strong></p>
              <p>Bank: BNI</p>
              <p>No. Rekening: 1234567890</p>
              <p>a.n. Gabungan Ahli Teknik Nasional Indonesia</p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentProof(null)
                  setPaymentError(null)
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
