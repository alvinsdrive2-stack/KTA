'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AnimatedProgress } from '@/components/ui/animated-progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Upload,
  FileText,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useSidebar } from '@/contexts/sidebar-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

interface KTARequest {
  id: string
  idIzin: string
  nik: string
  nama: string
  jabatanKerja: string
  subklasifikasi?: string
  jenjang: string
  noTelp: string
  email: string
  alamat: string
  tanggalDaftar: string
  status: string
  ktpUrl?: string
  fotoUrl?: string
  hargaRegion: number
  klasifikasi?: {
    id: string
    idKlasifikasi: string
    idSubklasifikasi: string
    kodeSubklasifikasi: string
    subklasifikasi: string
  }
  daerah?: {
    id: string
    namaDaerah: string
    kodeDaerah: string
  }
  payments?: Array<{
    id: string
    jumlah: number
    statusPembayaran: string
    invoiceNumber?: string
    rekeningTujuan?: string
    paidAt?: string
    bulkPayment?: {
      id: string
      buktiPembayaranUrl?: string
      status: string
    }
  }>
}

export default function KTADetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [ktaRequest, setKtaRequest] = useState<KTARequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState('')
  const [refreshingSiki, setRefreshingSiki] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Preview states
  const [showKtpPreview, setShowKtpPreview] = useState(false)
  const [showFotoPreview, setShowFotoPreview] = useState(false)
  const [ktpZoom, setKtpZoom] = useState(1)
  const [fotoZoom, setFotoZoom] = useState(1)

  const { setSidebarCollapsed } = useSidebar()

  useEffect(() => {
    fetchKTARequest()
  }, [params.id])

  const fetchKTARequest = async () => {
    try {
      const response = await fetch(`/api/kta/${params.id}`)
      const result = await response.json()

      if (response.ok && result.success) {
        setKtaRequest(result.data)
      } else {
        setError(result.error || 'KTA request not found')
      }
    } catch (error) {
      setError('Failed to fetch KTA request')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (type: 'ktp' | 'foto', file: File) => {
    setUploading(type)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    try {
      const response = await fetch(`/api/kta/${params.id}/upload`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        await fetchKTARequest()
      } else {
        setError(result.error || 'Upload failed')
      }
    } catch (error) {
      setError('Upload failed')
    } finally {
      setUploading('')
    }
  }

  const handleSubmitToPusat = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/kta/${params.id}/submit-to-pusat`, {
        method: 'POST',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        await fetchKTARequest()
      } else {
        setError(result.error || 'Failed to submit')
      }
    } catch (error) {
      setError('Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshSiki = async () => {
    setRefreshingSiki(true)
    setError(null)

    try {
      const response = await fetch(`/api/kta/${params.id}/refresh-siki`, {
        method: 'POST',
      })

      const result = await response.json()
      console.log('Refresh SIKI result:', result)

      if (response.ok && result.success) {
        await fetchKTARequest()
      } else {
        console.error('Refresh SIKI error:', result.error)
        setError(result.error || 'Gagal refresh data SIKI')
      }
    } catch (error) {
      console.error('Refresh SIKI catch:', error)
      setError('Gagal refresh data SIKI')
    } finally {
      setRefreshingSiki(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/kta/${params.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Berhasil',
          description: 'Permohonan KTA berhasil dihapus',
        })
        router.push('/dashboard/kta')
      } else {
        setError(result.error || 'Gagal menghapus permohonan')
        setDeleteDialogOpen(false)
      }
    } catch (error) {
      setError('Gagal menghapus permohonan')
      setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const togglePreviews = () => {
    const newState = !showKtpPreview
    setShowKtpPreview(newState)
    setShowFotoPreview(newState)
    setSidebarCollapsed(newState)
    setKtpZoom(1)
    setFotoZoom(1)
  }

  const closeAllPreviews = () => {
    setShowKtpPreview(false)
    setShowFotoPreview(false)
    setSidebarCollapsed(false)
    setKtpZoom(1)
    setFotoZoom(1)
  }

  const handleZoom = (type: 'ktp' | 'foto', direction: 'in' | 'out') => {
    if (type === 'ktp') {
      setKtpZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
    } else {
      setFotoZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-800',
      WAITING_PAYMENT: 'bg-amber-100 text-amber-800',
      WAITING_APPROVAL: 'bg-violet-100 text-violet-800',
      APPROVED: 'bg-emerald-100 text-emerald-800',
      REJECTED: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-slate-100 text-slate-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Draft',
      WAITING_PAYMENT: 'Menunggu Konfirmasi',
      WAITING_APPROVAL: 'Menunggu Verifikasi',
      APPROVED: 'Disetujui',
      READY_TO_PRINT: 'Siap Cetak',
      PRINTED: 'Sudah Cetak',
      REJECTED: 'Ditolak',
    }
    return labels[status] || status.replace(/_/g, ' ')
  }

  const getProgressPercentage = () => {
    if (!ktaRequest) return 0

    let progress = 0
    if (ktaRequest.ktpUrl) progress += 25
    if (ktaRequest.fotoUrl) progress += 25
    // Payment exists (PENDING, PAID, or VERIFIED) = 75%
    if (ktaRequest.payments && ktaRequest.payments.length > 0) progress += 25
    // Pusat verified = 100%
    if (ktaRequest.status === 'APPROVED' || ktaRequest.status === 'READY_TO_PRINT' || ktaRequest.status === 'PRINTED') progress += 25

    return progress
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat detail KTA..." />
      </div>
    )
  }

  if (!ktaRequest || error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/kta">
          <Button variant="ghost" className="mb-4 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">{error}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <div className={'transition-all duration-300 ' + (showKtpPreview || showFotoPreview ? 'pr-[480px]' : '')}>
        {/* Header - 3D Style */}
        <div className="flex items-center justify-between animate-slide-up-stagger stagger-1">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/kta">
              <Button variant="ghost" size="sm" className="hover:bg-slate-100">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Detail Permohonan KTA</h1>
              <p className="text-slate-500 text-sm">ID Izin: {ktaRequest.idIzin}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(ktaRequest.status)}>
              {getStatusLabel(ktaRequest.status)}
            </Badge>
            {/* Only show delete button for certain statuses */}
            {['DRAFT', 'FETCHED_FROM_SIKI', 'EDITED', 'WAITING_PAYMENT'].includes(ktaRequest.status) && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Hapus
              </Button>
            )}
          </div>
        </div>

        {/* Progress - 3D Style */}
        <Card className="card-3d mt-5 animate-slide-up-stagger stagger-2">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="flex items-center justify-between text-base font-semibold text-slate-900">
              Progress Permohonan
              <span className="text-sm font-normal text-slate-500">{getProgressPercentage()}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <AnimatedProgress value={getProgressPercentage()} className="w-full text-slate" />
            <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
              <div className={'flex items-center gap-2 ' + (ktaRequest.ktpUrl ? 'text-emerald-600' : 'text-slate-400')}>
                <FileText className="h-4 w-4" />
                <span>KTP</span>
              </div>
              <div className={'flex items-center gap-2 ' + (ktaRequest.fotoUrl ? 'text-emerald-600' : 'text-slate-400')}>
                <Upload className="h-4 w-4" />
                <span>Pas Foto</span>
              </div>
              <div className={'flex items-center gap-2 ' + (ktaRequest.payments && ktaRequest.payments.length > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                <CreditCard className="h-4 w-4" />
                <span>Pembayaran</span>
              </div>
              <div className={'flex items-center gap-2 ' + (ktaRequest.status === 'APPROVED' || ktaRequest.status === 'READY_TO_PRINT' || ktaRequest.status === 'PRINTED' ? 'text-emerald-600' : 'text-slate-400')}>
                <CheckCircle className="h-4 w-4" />
                <span>Approval</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Data - 3D Style */}
        <Card className="card-3d mt-5 animate-slide-up-stagger stagger-3">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900">Data Pemohon</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300"
                onClick={handleRefreshSiki}
                disabled={refreshingSiki}
              >
                <RotateCw className={`h-4 w-4 mr-2 ${refreshingSiki ? 'animate-spin' : ''}`} />
                {refreshingSiki ? 'Refreshing...' : 'Refresh Data SIKI'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700">NIK</Label>
                <p className="mt-1 text-sm text-slate-900 font-mono">{ktaRequest.nik}</p>
              </div>
              <div>
                <Label className="text-slate-700">Nama Lengkap</Label>
                <p className="mt-1 text-sm text-slate-900">{ktaRequest.nama}</p>
              </div>
              <div>
                <Label className="text-slate-700">Jabatan Kerja</Label>
                <p className="mt-1 text-sm text-slate-900">{ktaRequest.jabatanKerja}</p>
              </div>
              <div>
                <Label className="text-slate-700">Sub Klasifikasi</Label>
                <p className="mt-1 text-sm text-slate-900">
                  {ktaRequest.klasifikasi
                    ? `${ktaRequest.klasifikasi.kodeSubklasifikasi} - ${ktaRequest.klasifikasi.subklasifikasi}`
                    : ktaRequest.subklasifikasi || '-'}
                </p>
              </div>
              <div>
                <Label className="text-slate-700">Jenjang</Label>
                <p className="mt-1 text-sm text-slate-900">{ktaRequest.jenjang}</p>
              </div>
              <div>
                <Label className="text-slate-700">No. Telepon</Label>
                <p className="mt-1 text-sm text-slate-900">{ktaRequest.noTelp || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-700">Email</Label>
                <p className="mt-1 text-sm text-slate-900">{ktaRequest.email || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-700">Tanggal Daftar</Label>
                <p className="mt-1 text-sm text-slate-900">
                  {new Date(ktaRequest.tanggalDaftar).toLocaleDateString('id-ID')}
                </p>
              </div>
              <div className="md:col-span-2">
                <Label className="text-slate-700">Alamat</Label>
                <p className="mt-1 text-sm text-slate-900">{ktaRequest.alamat || '-'}</p>
              </div>
              {(ktaRequest.ktpUrl || ktaRequest.fotoUrl) && (
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-300"
                    onClick={togglePreviews}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Lihat Dokumen
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document Upload - 3D Style */}
        <Card className="card-3d mt-5 animate-slide-up-stagger stagger-4">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="text-base font-semibold text-slate-900">Upload Dokumen</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700">Scan KTP</Label>
                {ktaRequest.ktpUrl ? (
                  <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-sm text-emerald-700">Dokumen KTP tersedia</p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload('ktp', file)
                      }}
                      disabled={uploading === 'ktp'}
                      className="bg-white"
                    />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-slate-700">Pas Foto</Label>
                {ktaRequest.fotoUrl ? (
                  <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-sm text-emerald-700">Pas Foto tersedia</p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload('foto', file)
                      }}
                      disabled={uploading === 'foto'}
                      className="bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment - 3D Style */}
        <Card className="card-3d mt-5 animate-slide-up-stagger stagger-5">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <CreditCard className="h-5 w-5 text-slate-700" />
              Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="space-y-4">
              <div>
                <Label className="text-slate-700">Biaya KTA</Label>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  Rp {ktaRequest.hargaRegion?.toLocaleString('id-ID') || '...'}
                </p>
              </div>

              {ktaRequest.payments && ktaRequest.payments[0] ? (
                <>
                  <div>
                    <Label className="text-slate-700">Status Pembayaran</Label>
                    <div className="mt-1">
                      {ktaRequest.payments[0].statusPembayaran === 'PENDING' && (
                        <Badge className="bg-amber-100 text-amber-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Menunggu Konfirmasi
                        </Badge>
                      )}
                      {ktaRequest.payments[0].statusPembayaran === 'PAID' && (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Sudah Dibayar
                        </Badge>
                      )}
                      {ktaRequest.payments[0].statusPembayaran === 'VERIFIED' && (
                        <Badge className="bg-sky-100 text-sky-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Terverifikasi
                        </Badge>
                      )}
                    </div>
                  </div>

                  {ktaRequest.payments[0].invoiceNumber && (
                    <div>
                      <Label className="text-slate-700">No. Invoice</Label>
                      <p className="mt-1 text-sm text-slate-900">{ktaRequest.payments[0].invoiceNumber}</p>
                    </div>
                  )}

                  {ktaRequest.payments[0].bulkPayment?.buktiPembayaranUrl && (
                    <div>
                      <Label className="text-slate-700">Bukti Pembayaran</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1 border-slate-300"
                        onClick={() => window.open(ktaRequest.payments[0].bulkPayment!.buktiPembayaranUrl, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Lihat Bukti
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <Alert className="bg-amber-50 border-amber-200">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-sm">
                    Pembayaran belum dilakukan. Silakan upload bukti pembayaran melalui halaman pembayaran.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          {ktaRequest.status === 'DRAFT' && ktaRequest.ktpUrl && ktaRequest.fotoUrl && (
            <Button
              onClick={handleSubmitToPusat}
              disabled={loading || !ktaRequest.payments?.[0] || ktaRequest.payments[0].statusPembayaran !== 'PAID'}
              className="bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-md"
            >
              {loading ? 'Memproses...' : 'Ajukan ke Pusat'}
            </Button>
          )}
        </div>
      </div>

      {/* Floating Preview Panels */}
      {(showKtpPreview || showFotoPreview) && (
        <>
          {/* Backdrop - Left side only, allows interacting with main content */}
          <div
            className="fixed inset-y-0 left-0 right-[444px] z-30"
            onClick={closeAllPreviews}
          />

          {/* Combined Preview Container */}
          <div className="fixed top-6 bottom-6 right-6 w-[420px] flex flex-col gap-0 z-40">
            {/* KTP Preview Panel - Top */}
            {showKtpPreview && ktaRequest.ktpUrl && (
              <div className="flex-1 bg-white rounded-t-xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-semibold text-slate-900 text-sm">Scan KTP</h3>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('ktp', 'in')}>
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('ktp', 'out')}>
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-3 bg-slate-100 overflow-auto">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full" style={{ transform: `scale(${ktpZoom})`, transformOrigin: 'top center' }}>
                    {ktaRequest.ktpUrl.toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={ktaRequest.ktpUrl}
                        className="w-full h-full"
                        title="Scan KTP PDF"
                      />
                    ) : (
                      <img
                        src={ktaRequest.ktpUrl}
                        alt="Scan KTP"
                        className="w-full h-auto object-contain"
                      />
                    )}
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex justify-center">
                  <p className="text-xs text-slate-500">{Math.round(ktpZoom * 100)}%</p>
                </div>
              </div>
            )}

            {/* Divider */}
            {showKtpPreview && showFotoPreview && (
              <div className="h-0" />
            )}

            {/* Pas Foto Preview Panel - Bottom */}
            {showFotoPreview && ktaRequest.fotoUrl && (
              <div className="flex-1 bg-white rounded-b-xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-semibold text-slate-900 text-sm">Pas Foto</h3>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('foto', 'in')}>
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('foto', 'out')}>
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={closeAllPreviews}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-3 bg-slate-100 overflow-auto">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full flex justify-center" style={{ transform: `scale(${fotoZoom})`, transformOrigin: 'top center' }}>
                    <img
                      src={ktaRequest.fotoUrl}
                      alt="Pas Foto"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex justify-center">
                  <p className="text-xs text-slate-500">{Math.round(fotoZoom * 100)}%</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-slate-900">Hapus Permohonan KTA</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus permohonan KTA atas nama <strong>{ktaRequest?.nama}</strong>?<br />
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
