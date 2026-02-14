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
import { ArrowLeft, Download, FileText, User, IdCard, Calendar, MapPin, Phone, Mail, Building, Eye, Upload, AlertCircle, Loader2, RefreshCw, Info, CheckCircle, Pencil, Save, X } from 'lucide-react'
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
  ktpUrl: string | null
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

  // Document upload states
  const [uploadingKtp, setUploadingKtp] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  // Inline edit states
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Refresh states
  const [refreshing, setRefreshing] = useState(false)
  const [showRefreshModal, setShowRefreshModal] = useState(false)
  const [sikiChanges, setSikiChanges] = useState<any>(null)

  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN' || session?.user.role === 'KEUANGAN'

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

  const handleRefreshFromSIKI = async () => {
    if (!kta) return

    setRefreshing(true)
    try {
      const response = await fetch('/api/siki/get-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idIzin: kta.idIzin })
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        toast({
          variant: 'destructive',
          title: 'Gagal Refresh Data',
          description: result.error || 'Gagal mengambil data dari SIKI'
        })
        return
      }

      const newSikiData = result.data

      // Compare fields
      const changes: any = {}

      // Fields to compare
      const fieldsToCompare = [
        { key: 'nama', label: 'Nama Lengkap' },
        { key: 'nik', label: 'NIK' },
        { key: 'jabatanKerja', label: 'Jabatan Kerja', altKey: 'jabatan' },
        { key: 'jenjang', label: 'Jenjang' },
        { key: 'telp', label: 'No. Telepon', altKey: 'noTelp' },
        { key: 'email', label: 'Email' },
        { key: 'alamat', label: 'Alamat' },
        { key: 'klasifikasi.subklasifikasi', label: 'Subklasifikasi' }
      ]

      fieldsToCompare.forEach(field => {
        const keys = field.key.split('.')
        let oldValue = kta[field.key as keyof KTARequest]

        // Try alt key if main key doesn't exist
        if (oldValue === undefined && field.altKey) {
          oldValue = kta[field.altKey as keyof KTARequest]
        }

        let newValue = newSikiData
        keys.forEach(k => {
          newValue = newValue?.[k]
        })

        // For subklasifikasi, compare with current value
        if (field.key === 'klasifikasi.subklasifikasi') {
          oldValue = kta.subklasifikasi
          newValue = newSikiData.klasifikasi?.subklasifikasi || newSikiData.subklasifikasi
        }

        if (oldValue !== newValue && oldValue?.toString() !== newValue?.toString()) {
          changes[field.label] = { old: oldValue, new: newValue }
        }
      })

      if (Object.keys(changes).length > 0) {
        setSikiChanges({ changes, newSikiData })
        setShowRefreshModal(true)
      } else {
        toast({
          variant: 'default',
          title: 'Data SAMA',
          description: 'Tidak ada perubahan data dari SIKI'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal Refresh Data',
        description: 'Terjadi kesalahan saat mengambil data dari SIKI'
      })
    } finally {
      setRefreshing(false)
    }
  }

  const confirmRefreshUpdate = async () => {
    if (!kta || !sikiChanges) return

    setRefreshing(true)
    setShowRefreshModal(false)

    try {
      // The existing API fetches directly from SIKI, no need to send sikiData
      const response = await fetch(`/api/kta/${kta.id}/refresh-siki`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Data Berhasil Diupdate',
          description: 'Data KTA telah diperbarui dengan data terbaru dari SIKI'
        })
        fetchKTADetail(kta.id)
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal Update Data',
          description: result.error || 'Terjadi kesalahan saat mengupdate data'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal Update Data',
        description: 'Terjadi kesalahan saat mengupdate data'
      })
    } finally {
      setRefreshing(false)
      setSikiChanges(null)
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

  const handleUploadDocument = async (type: 'ktp' | 'foto', file: File) => {
    if (!kta) return

    const setUploading = type === 'ktp' ? setUploadingKtp : setUploadingFoto
    setUploading(true)

    try {
      // Upload file
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const uploadResponse = await fetch('/api/upload/document', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await uploadResponse.json()

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || 'Gagal mengupload file')
      }

      // Update KTA with document URL (don't change status)
      const updateResponse = await fetch(`/api/kta/${kta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [type === 'ktp' ? 'ktpUrl' : 'fotoUrl']: uploadData.url,
        }),
      })

      if (!updateResponse.ok) {
        throw new Error('Gagal mengupdate data KTA')
      }

      toast({
        variant: 'success',
        title: 'Upload Berhasil',
        description: `${type === 'ktp' ? 'KTP' : 'Foto'} berhasil diupload`,
      })

      // Refresh KTA data
      fetchKTADetail(kta.id)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload Gagal',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      })
    } finally {
      setUploading(false)
    }
  }

  // Inline edit functions
  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue || '')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveEdit = async (field: string) => {
    if (!kta || !editValue.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nilai tidak boleh kosong',
        description: 'Silakan isi nilai yang valid',
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/kta/${kta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: editValue.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Gagal menyimpan perubahan')
      }

      toast({
        variant: 'success',
        title: 'Berhasil',
        description: 'Data berhasil diperbarui',
      })

      // Update local state
      setKta({ ...kta, [field]: editValue.trim() })
      setEditingField(null)
      setEditValue('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal menyimpan',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      })
    } finally {
      setSaving(false)
    }
  }

  // Check if field is empty and can be edited
  const isEmpty = (value: string | null | undefined) => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string' && value.trim() === '') return true
    return false
  }

  // Render editable field
  const renderEditableField = (
    field: string,
    value: string | null | undefined,
    displayValue?: React.ReactNode,
    type: 'text' | 'email' | 'number' = 'text',
    maxLength?: number
  ) => {
    const isEditing = editingField === field
    const isFieldEmpty = isEmpty(value)

    if (isEditing) {
      return (
        <div className="flex gap-2">
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1"
            maxLength={maxLength}
          />
          <Button size="sm" onClick={() => saveEdit(field)} disabled={saving}>
            <Save className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEdit}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    return (
      <div
        className={`flex items-center gap-2 ${isFieldEmpty ? 'cursor-pointer hover:bg-amber-50 p-1 rounded -mx-1' : ''}`}
        onClick={() => isFieldEmpty && startEdit(field, value || '')}
      >
        {displayValue || (
          <span className="text-amber-600 italic flex items-center gap-1">
            {isFieldEmpty && <Pencil className="h-3 w-3" />}
            Kosong - klik untuk isi
          </span>
        )}
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      APPROVED_BY_PUSAT: { label: 'Terverifikasi', className: 'bg-green-100 text-green-800 border-green-200' },
      READY_TO_PRINT: { label: 'Siap Cetak', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
      PRINTED: { label: 'Sudah Cetak', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
      IMPORTED_PENDING_DOCS: { label: 'Perlu Dokumen', className: 'bg-amber-100 text-amber-800 border-amber-200' },
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-800 border-gray-200' },
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
      <div className="flex items-center justify-between animate-slide-up-stagger stagger-1">
        <div className="flex items-center gap-4">
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshFromSIKI}
          disabled={refreshing}
          className="gap-2"
        >
          {refreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh SIKI
            </>
          )}
        </Button>
      </div>

      {/* No. KTA Card */}
      {kta.nomorKTA && (
        <Card className="card-3d bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 animate-slide-up-stagger stagger-2">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-700 text-sm font-medium mb-1">Nomor KTA</p>
                <p className="text-slate-800 text-3xl font-bold font-mono tracking-wider">{kta.nomorKTA || 'Belum Dibuat'}</p>
              </div>
              <IdCard className="h-12 w-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Documents Section - for IMPORTED_PENDING_DOCS status */}
      {(!kta.ktpUrl || !kta.fotoUrl) && (
        <Card className="card-3d bg-amber-50 border-amber-200 animate-slide-up-stagger stagger-2">
          <CardHeader className="border-b border-amber-200 bg-amber-100/50">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-900">
              <Upload className="h-5 w-5 text-amber-700" />
              Upload Dokumen Wajib
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {(!kta.ktpUrl || !kta.fotoUrl) && (
              <Alert className="mb-4 bg-amber-100 border-amber-300">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-800">
                  KTP dan Pas Foto harus diupload untuk melanjutkan proses KTA. Format yang diterima: JPG, PNG, atau PDF (maksimal 5MB).
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* KTP Upload */}
              <div className="border-2 border-dashed border-amber-300 rounded-lg p-6 text-center bg-white">
                <IdCard className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                <h3 className="font-semibold text-amber-900 mb-1">KTP (Kartu Tanda Penduduk)</h3>
                {kta.ktpUrl ? (
                  <div className="space-y-2">
                    <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto" />
                    <p className="text-sm text-emerald-700 font-medium">KTP Sudah Diupload</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => window.open(kta.ktpUrl, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Lihat
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUploadDocument('ktp', file)
                      }}
                      className="hidden"
                      id={`ktp-upload-${kta.id}`}
                    />
                    <Button
                      variant="outline"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      disabled={uploadingKtp}
                      onClick={() => document.getElementById(`ktp-upload-${kta.id}`)?.click()}
                    >
                      {uploadingKtp ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Pilih File KTP
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Foto Upload */}
              <div className="border-2 border-dashed border-amber-300 rounded-lg p-6 text-center bg-white">
                <User className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                <h3 className="font-semibold text-amber-900 mb-1">Pas Foto 3x4</h3>
                {kta.fotoUrl ? (
                  <div className="space-y-2">
                    <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto" />
                    <p className="text-sm text-emerald-700 font-medium">Foto Sudah Diupload</p>
                    <div className="flex justify-center">
                      <img
                        src={kta.fotoUrl}
                        alt={kta.nama}
                        className="w-20 h-24 object-cover rounded border border-slate-200"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUploadDocument('foto', file)
                      }}
                      className="hidden"
                      id={`foto-upload-${kta.id}`}
                    />
                    <Button
                      variant="outline"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      disabled={uploadingFoto}
                      onClick={() => document.getElementById(`foto-upload-${kta.id}`)?.click()}
                    >
                      {uploadingFoto ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Pilih File Foto
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {kta.ktpUrl && kta.fotoUrl && (
              <div className="mt-4 p-3 bg-emerald-100 border border-emerald-300 rounded-lg">
                <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Dokumen Lengkap! Anda dapat melanjutkan ke proses berikutnya.
                </p>
              </div>
            )}
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

              {/* Nama Lengkap - Editable if empty */}
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Nama Lengkap</p>
                {!isEmpty(kta.nama) && editingField !== 'nama' ? (
                  <p className="text-base font-semibold text-slate-900">{kta.nama}</p>
                ) : (
                  renderEditableField('nama', kta.nama)
                )}
              </div>

              {/* NIK - Editable if empty */}
              <div className="space-y-1">
                <p className="text-sm text-slate-500">NIK</p>
                {!isEmpty(kta.nik) && editingField !== 'nik' ? (
                  <p className="text-base font-mono text-slate-900">{kta.nik}</p>
                ) : (
                  renderEditableField('nik', kta.nik, undefined, 'text', 16)
                )}
              </div>

              {/* ID Izin - Editable if empty */}
              <div className="space-y-1">
                <p className="text-sm text-slate-500">ID Izin</p>
                {!isEmpty(kta.idIzin) && editingField !== 'idIzin' ? (
                  <p className="text-base font-mono text-slate-900">{kta.idIzin}</p>
                ) : (
                  renderEditableField('idIzin', kta.idIzin)
                )}
              </div>

              {/* Jabatan Kerja - Editable if empty */}
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Jabatan Kerja</p>
                {!isEmpty(kta.jabatanKerja) && editingField !== 'jabatanKerja' ? (
                  <p className="text-base text-slate-900">{kta.jabatanKerja}</p>
                ) : (
                  renderEditableField('jabatanKerja', kta.jabatanKerja)
                )}
              </div>

              {/* Subklasifikasi - Editable if empty */}
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Subklasifikasi</p>
                {!isEmpty(kta.subklasifikasi) && editingField !== 'subklasifikasi' ? (
                  <p className="text-base text-slate-900">{kta.subklasifikasi}</p>
                ) : (
                  renderEditableField('subklasifikasi', kta.subklasifikasi)
                )}
              </div>

              {/* Jenjang - Editable if empty */}
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Jenjang</p>
                {!isEmpty(kta.jenjang) && editingField !== 'jenjang' ? (
                  <Badge variant="outline" className="border-blue-200 text-blue-700">
                    {kta.jenjang}
                  </Badge>
                ) : (
                  <div>
                    {editingField === 'jenjang' ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 w-20"
                        />
                        <Button size="sm" onClick={() => saveEdit('jenjang')} disabled={saving}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-2 cursor-pointer hover:bg-amber-50 p-1 rounded -mx-1`}
                        onClick={() => isEmpty(kta.jenjang) && startEdit('jenjang', kta.jenjang || '')}
                      >
                        <span className="text-amber-600 italic flex items-center gap-1">
                          <Pencil className="h-3 w-3" />
                          Kosong - klik untuk isi
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* No. Telepon - Editable if empty */}
              <div className="space-y-1">
                <p className="text-sm text-slate-500">No. Telepon</p>
                {!isEmpty(kta.noTelp) && editingField !== 'noTelp' ? (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <p className="text-base text-slate-900">{kta.noTelp}</p>
                  </div>
                ) : (
                  renderEditableField('noTelp', kta.noTelp, undefined, 'text')
                )}
              </div>

              {/* Email - Editable if empty */}
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Email</p>
                {!isEmpty(kta.email) && editingField !== 'email' ? (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <p className="text-base text-slate-900">{kta.email}</p>
                  </div>
                ) : (
                  renderEditableField('email', kta.email, undefined, 'email')
                )}
              </div>

              {/* Alamat - Editable if empty */}
              <div className="md:col-span-2 space-y-1">
                <p className="text-sm text-slate-500">Alamat</p>
                {!isEmpty(kta.alamat) && editingField !== 'alamat' ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 mt-1" />
                    <p className="text-base text-slate-900">{kta.alamat}</p>
                  </div>
                ) : (
                  <div>
                    {editingField === 'alamat' ? (
                      <div className="flex gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => saveEdit('alamat')} disabled={saving}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className={`flex items-start gap-2 cursor-pointer hover:bg-amber-50 p-1 rounded -mx-1`}
                        onClick={() => isEmpty(kta.alamat) && startEdit('alamat', kta.alamat || '')}
                      >
                        <MapPin className="h-4 w-4 text-slate-400 mt-1" />
                        <span className="text-amber-600 italic flex items-center gap-1">
                          <Pencil className="h-3 w-3" />
                          Kosong - klik untuk isi
                        </span>
                      </div>
                    )}
                  </div>
                )}
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
          {(!kta.nomorKTA ) && (
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
              <p>Bank: BTN KC Jakarta Kuningan</p>
              <p>No. Rekening: 00001.01.30.000986.9</p>
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

      {/* Refresh Confirmation Modal */}
      <Dialog open={showRefreshModal} onOpenChange={setShowRefreshModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Perubahan Data dari SIKI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Ditemukan {Object.keys(sikiChanges?.changes || {}).length} field yang berbeda dari data SIKI terbaru.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {sikiChanges?.changes && Object.entries(sikiChanges.changes).map(([field, values]: [string, any]) => (
                <div key={field} className="border border-slate-200 rounded-lg p-3">
                  <p className="font-semibold text-sm text-slate-700 mb-2">{field}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-red-600 font-medium mb-1">Data Lama:</p>
                      <p className="text-slate-600 bg-red-50 p-2 rounded">{values.old || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-medium mb-1">Data Baru (SIKI):</p>
                      <p className="text-slate-600 bg-green-50 p-2 rounded">{values.new || '-'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRefreshModal(false)
                  setSikiChanges(null)
                }}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                onClick={confirmRefreshUpdate}
                disabled={refreshing}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {refreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Mengupdate...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
