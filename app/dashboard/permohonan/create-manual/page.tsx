'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Upload, X, CreditCard, User, FileImage, IdCard, Eye, ZoomIn, ZoomOut } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { Separator as UISeparator } from '@/components/ui/separator'
import { useSidebar } from '@/contexts/sidebar-context'
import { useSession } from '@/hooks/useSession'
import { cn } from '@/lib/utils'

const formSchema = z.object({
  nik: z.string().min(16, 'NIK harus 16 digit').max(16, 'NIK harus 16 digit'),
  nama: z.string().min(1, 'Nama harus diisi'),
  jabatanKerja: z.string().min(1, 'Jabatan kerja harus diisi'),
  subklasifikasi: z.string().min(1, 'Sub klasifikasi harus diisi'),
  jenjang: z.string().min(1, 'Jenjang harus diisi'),
  noTelp: z.string().min(1, 'No. telepon harus diisi'),
  email: z.string().email('Email tidak valid'),
  alamat: z.string().min(1, 'Alamat harus diisi'),
})

type FormData = z.infer<typeof formSchema>

export default function CreateManualPage() {
  const router = useRouter()
  const { setSidebarCollapsed } = useSidebar()
  const { session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Daerah states
  const [daerahList, setDaerahList] = useState<any[]>([])
  const [selectedDaerahId, setSelectedDaerahId] = useState<string>('')

  // Pricing states
  const [diskonPersen, setDiskonPersen] = useState(0)
  const [hargaBase, setHargaBase] = useState(0)
  const [hargaFinal, setHargaFinal] = useState(0)

  // File states
  const [ktpFile, setKtpFile] = useState<File | null>(null)
  const [ktpPreview, setKtpPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  // Preview modal states
  const [ktpModalOpen, setKtpModalOpen] = useState(false)
  const [fotoModalOpen, setFotoModalOpen] = useState(false)
  const [ktpZoom, setKtpZoom] = useState(1)
  const [fotoZoom, setFotoZoom] = useState(1)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nik: '',
      nama: '',
      jabatanKerja: '',
      subklasifikasi: '',
      jenjang: '',
      noTelp: '',
      email: '',
      alamat: '',
    },
  })

  // Watch jenjang for price calculation
  const jenjang = form.watch('jenjang')

  // Fetch daerah diskon on component mount
  useEffect(() => {
    const fetchDiskon = async () => {
      try {
        const response = await fetch('/api/daerah/my-diskon')
        const data = await response.json()
        if (data.success) {
          setDiskonPersen(data.diskonPersen)
        }
      } catch (error) {
        console.error('Failed to fetch diskon:', error)
      }
    }

    fetchDiskon()
  }, [])

  // Fetch daerah list for PUSAT/ADMIN users
  useEffect(() => {
    const fetchDaerahList = async () => {
      try {
        const response = await fetch('/api/daerah')
        const data = await response.json()
        if (data.success) {
          setDaerahList(data.daerah || [])
        }
      } catch (error) {
        console.error('Failed to fetch daerah list:', error)
      }
    }

    const userRole = session?.user?.role
    const userDaerahKode = session?.user?.daerah?.kodeDaerah
    const canAssignAnyDaerah = userRole === 'PUSAT' || userRole === 'ADMIN' || userDaerahKode === '00'

    if (canAssignAnyDaerah) {
      fetchDaerahList()
      if (session?.user?.daerahId) {
        setSelectedDaerahId(session.user.daerahId)
      }
    }
  }, [session])

  // Calculate price when jenjang or diskon changes
  useEffect(() => {
    if (jenjang) {
      const jenjangNum = parseInt(jenjang, 10)
      const base = jenjangNum >= 7 ? 300000 : 100000
      setHargaBase(base)
      setHargaFinal(base - (base * diskonPersen / 100))
    }
  }, [jenjang, diskonPersen])

  // Check if user can assign to any daerah
  const canAssignAnyDaerah = session?.user?.role === 'PUSAT' ||
                             session?.user?.role === 'ADMIN' ||
                             session?.user?.daerah?.kodeDaerah === '00'

  const handleFileChange = (type: 'ktp' | 'foto', file: File) => {
    setError(null)

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('❌ Ukuran file maksimal 5MB')
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setError('❌ Format file harus JPG, PNG, atau PDF')
      return
    }

    if (type === 'ktp') {
      setKtpFile(file)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => setKtpPreview(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        setKtpPreview(null)
      }
    } else {
      setFotoFile(file)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => setFotoPreview(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        setFotoPreview(null)
      }
    }
  }

  const handleZoom = (type: 'ktp' | 'foto', direction: 'in' | 'out') => {
    if (type === 'ktp') {
      setKtpZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
    } else {
      setFotoZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
    }
  }

  const closeAllPreviews = () => {
    setKtpModalOpen(false)
    setFotoModalOpen(false)
    setSidebarCollapsed(false)
    setKtpZoom(1)
    setFotoZoom(1)
  }

  const uploadFile = async (file: File, type: 'ktp' | 'foto'): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const response = await fetch('/api/upload/document', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Failed to upload ${type}`)
    }

    const data = await response.json()
    return data.url
  }

  const onSubmit = async (data: FormData) => {
    // Validate files
    if (!ktpFile) {
      setError('❌ Harap upload scan KTP')
      return
    }
    if (!fotoFile) {
      setError('❌ Harap upload pas foto')
      return
    }

    setIsLoading(true)
    setUploadProgress(0)

    try {
      // Upload files
      setUploadProgress(10)
      const ktpUrl = await uploadFile(ktpFile, 'ktp')
      setUploadProgress(50)
      const fotoUrl = await uploadFile(fotoFile, 'foto')
      setUploadProgress(80)

      // Create KTA request
      const response = await fetch('/api/kta/create-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          ktpUrl,
          fotoUrl,
          daerahId: canAssignAnyDaerah ? selectedDaerahId : undefined,
        }),
      })

      const result = await response.json()
      setUploadProgress(100)

      if (response.ok) {
        router.push(`/dashboard/permohonan?success=true&nama=${encodeURIComponent(data.nama)}`)
      } else {
        setError(`❌ ${result.error || 'Gagal menyimpan permohonan'}`)
      }
    } catch (error) {
      setError('❌ Gagal mengupload file atau menyimpan data. Periksa koneksi internet Anda.')
    } finally {
      setIsLoading(false)
      setUploadProgress(0)
    }
  }

  const jenjangOptions = Array.from({ length: 9 }, (_, i) => (i + 1).toString())

  return (
    <div className={cn(
      'space-y-5 transition-all duration-300',
      (ktpModalOpen || fotoModalOpen) && 'pr-[480px]'
    )}>
      {/* Header */}
      <div className="animate-slide-up-stagger stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">Permohonan KTA Manual</h1>
        <p className="text-slate-500 text-sm">
          Isi data permohonan KTA secara manual
        </p>
      </div>

      {/* Form Card */}
      <Card className="card-3d animate-slide-up-stagger stagger-2">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <User className="h-5 w-5 text-slate-700" />
            Data Pemohon
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* NIK */}
              <div>
                <Label htmlFor="nik" className="text-slate-700">
                  NIK <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="nik"
                  placeholder="Masukkan 16 digit NIK"
                  {...form.register('nik')}
                  disabled={isLoading}
                  maxLength={16}
                  className="bg-white"
                />
                {form.formState.errors.nik && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.nik.message}</p>
                )}
              </div>

              {/* Nama */}
              <div>
                <Label htmlFor="nama" className="text-slate-700">
                  Nama Lengkap <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="nama"
                  placeholder="Masukkan nama lengkap"
                  {...form.register('nama')}
                  disabled={isLoading}
                  className="bg-white"
                />
                {form.formState.errors.nama && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.nama.message}</p>
                )}
              </div>

              {/* Jabatan Kerja */}
              <div>
                <Label htmlFor="jabatanKerja" className="text-slate-700">
                  Jabatan Kerja <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="jabatanKerja"
                  placeholder="Contoh: Ahli K3 Muda"
                  {...form.register('jabatanKerja')}
                  disabled={isLoading}
                  className="bg-white"
                />
                {form.formState.errors.jabatanKerja && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.jabatanKerja.message}</p>
                )}
              </div>

              {/* Sub Klasifikasi */}
              <div>
                <Label htmlFor="subklasifikasi" className="text-slate-700">
                  Sub Klasifikasi <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="subklasifikasi"
                  placeholder="Contoh: M.562.01"
                  {...form.register('subklasifikasi')}
                  disabled={isLoading}
                  className="bg-white"
                />
                {form.formState.errors.subklasifikasi && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.subklasifikasi.message}</p>
                )}
              </div>

              {/* Jenjang */}
              <div>
                <Label htmlFor="jenjang" className="text-slate-700">
                  Jenjang <span className="text-red-600">*</span>
                </Label>
                <select
                  id="jenjang"
                  {...form.register('jenjang')}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-100"
                >
                  <option value="">Pilih Jenjang</option>
                  {jenjangOptions.map(j => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                {form.formState.errors.jenjang && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.jenjang.message}</p>
                )}
              </div>

              {/* No Telp */}
              <div>
                <Label htmlFor="noTelp" className="text-slate-700">
                  No. Telepon <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="noTelp"
                  placeholder="Contoh: 08123456789"
                  {...form.register('noTelp')}
                  disabled={isLoading}
                  className="bg-white"
                />
                {form.formState.errors.noTelp && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.noTelp.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="md:col-span-2">
                <Label htmlFor="email" className="text-slate-700">
                  Email <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contoh@email.com"
                  {...form.register('email')}
                  disabled={isLoading}
                  className="bg-white"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>

              {/* Alamat */}
              <div className="md:col-span-2">
                <Label htmlFor="alamat" className="text-slate-700">
                  Alamat <span className="text-red-600">*</span>
                </Label>
                <textarea
                  id="alamat"
                  placeholder="Masukkan alamat lengkap"
                  {...form.register('alamat')}
                  disabled={isLoading}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-100"
                />
                {form.formState.errors.alamat && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.alamat.message}</p>
                )}
              </div>
            </div>

            {/* Daerah Selection - Only for PUSAT/ADMIN/Nasional users */}
            {canAssignAnyDaerah && daerahList.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="daerah" className="text-slate-700">Daerah</Label>
                <select
                  id="daerah"
                  value={selectedDaerahId}
                  onChange={(e) => setSelectedDaerahId(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-100"
                >
                  <option value="">Pilih Daerah</option>
                  {daerahList.map((daerah) => (
                    <option key={daerah.id} value={daerah.id}>
                      {daerah.namaDaerah}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Document Upload Card */}
      <Card className="card-3d animate-slide-up-stagger stagger-3">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Upload className="h-5 w-5 text-slate-700" />
            Upload Dokumen
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* KTP Upload */}
            <div>
              <Label className="text-sm font-medium text-slate-700">
                Scan KTP <span className="text-red-600">*</span>
              </Label>
              <div className="mt-2">
                {ktpPreview ? (
                  <div className="relative">
                    <div className="border-2 border-slate-200 rounded-lg p-2 bg-slate-50">
                      <img
                        src={ktpPreview}
                        alt="KTP Preview"
                        className="w-full h-48 object-contain rounded"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setKtpModalOpen(true)}
                        className="flex-1 border-slate-300"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setKtpFile(null)
                          setKtpPreview(null)
                        }}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                    <div className="text-center">
                      <IdCard className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600 mb-2">
                        Klik untuk upload atau drag & drop
                      </p>
                      <p className="text-xs text-slate-500">JPG, PNG, atau PDF (Max 5MB)</p>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileChange('ktp', file)
                        }}
                        disabled={isLoading}
                        className="hidden"
                        id="ktp-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('ktp-upload')?.click()}
                        disabled={isLoading}
                        className="mt-2"
                      >
                        Pilih File
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pas Foto Upload */}
            <div>
              <Label className="text-sm font-medium text-slate-700">
                Pas Foto <span className="text-red-600">*</span>
              </Label>
              <div className="mt-2">
                {fotoPreview ? (
                  <div className="relative">
                    <div className="border-2 border-slate-200 rounded-lg p-2 bg-slate-50">
                      <img
                        src={fotoPreview}
                        alt="Foto Preview"
                        className="w-full h-48 object-contain rounded"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFotoModalOpen(true)}
                        className="flex-1 border-slate-300"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFotoFile(null)
                          setFotoPreview(null)
                        }}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                    <div className="text-center">
                      <FileImage className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600 mb-2">
                        Klik untuk upload atau drag & drop
                      </p>
                      <p className="text-xs text-slate-500">JPG atau PNG (Max 5MB)</p>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileChange('foto', file)
                        }}
                        disabled={isLoading}
                        className="hidden"
                        id="foto-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('foto-upload')?.click()}
                        disabled={isLoading}
                        className="mt-2"
                      >
                        Pilih File
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Card */}
      <Card className="card-3d animate-slide-up-stagger stagger-4">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <CreditCard className="h-5 w-5 text-slate-700" />
            Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">Jenjang</Label>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {jenjang || '-'}
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Harga Base</span>
                <span className="font-medium">Rp {hargaBase.toLocaleString('id-ID')}</span>
              </div>

              {diskonPersen > 0 && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-600">Diskon</span>
                  <span className="font-medium text-green-600">-Rp {(hargaBase - hargaFinal).toLocaleString('id-ID')}</span>
                </div>
              )}

              <UISeparator />

              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Total Bayar</span>
                <span className="text-xl font-bold text-blue-600">
                  Rp {hargaFinal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                Harga berdasarkan jenjang: 1-6 = Rp 100.000, 7-9 = Rp 300.000
              </AlertDescription>
            </Alert>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Pembayaran dapat dilakukan setelah permohonan disimpan.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl z-50 animate-slide-up">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
              className="border-slate-300"
            >
              Batal
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={isLoading}
              className="flex-1 bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-md"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <PulseLogo className="scale-50" />
                  {uploadProgress > 0 && ` (${uploadProgress}%)`}
                </span>
              ) : (
                'Simpan Permohonan'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Spacer for fixed bottom bar */}
      <div className="h-24" />

      {/* Preview Modals */}
      {ktpModalOpen && ktpPreview && (
        <>
          <div className="fixed inset-0 bg-black/50 z-30" onClick={closeAllPreviews} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-40 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Scan KTP</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('ktp', 'in')}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('ktp', 'out')}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={closeAllPreviews}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="p-4 bg-slate-100 overflow-auto max-h-[70vh]">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden flex justify-center" style={{ transform: `scale(${ktpZoom})`, transformOrigin: 'top center' }}>
                <img src={ktpPreview} alt="KTP Preview" className="max-w-full" />
              </div>
            </div>
          </div>
        </>
      )}

      {fotoModalOpen && fotoPreview && (
        <>
          <div className="fixed inset-0 bg-black/50 z-30" onClick={closeAllPreviews} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-40 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Pas Foto</h3>
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
            <div className="p-4 bg-slate-100 overflow-auto max-h-[70vh]">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden flex justify-center" style={{ transform: `scale(${fotoZoom})`, transformOrigin: 'top center' }}>
                <img src={fotoPreview} alt="Foto Preview" className="max-w-full" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
