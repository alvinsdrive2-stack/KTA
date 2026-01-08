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
import { AlertCircle, Search, User, Mail, Phone, MapPin, Calendar, CreditCard, Eye, Maximize2, X, ZoomIn, ZoomOut, RotateCw, Download, Separator } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { Separator as UISeparator } from '@/components/ui/separator'
import { useSidebar } from '@/contexts/sidebar-context'
import { cn } from '@/lib/utils'

const formSchema = z.object({
  idIzin: z.string().min(1, 'ID Izin harus diisi'),
})

type FormData = z.infer<typeof formSchema>

export default function KTAApplyPage() {
  const router = useRouter()
  const { setSidebarCollapsed } = useSidebar()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sikiData, setSikiData] = useState<any>(null)
  const [ktaRequestId, setKtaRequestId] = useState<string | null>(null)

  // Pricing states
  const [diskonPersen, setDiskonPersen] = useState(0)
  const [hargaBase, setHargaBase] = useState(0)
  const [hargaFinal, setHargaFinal] = useState(0)

  // Modal states
  const [ktpModalOpen, setKtpModalOpen] = useState(false)
  const [fotoModalOpen, setFotoModalOpen] = useState(false)
  const [compareModalOpen, setCompareModalOpen] = useState(false)

  // Zoom states
  const [ktpZoom, setKtpZoom] = useState(1)
  const [fotoZoom, setFotoZoom] = useState(1)
  const [compareKtpZoom, setCompareKtpZoom] = useState(1)
  const [compareFotoZoom, setCompareFotoZoom] = useState(1)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      idIzin: '',
    },
  })

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

  // Calculate price when jenjang or diskon changes
  useEffect(() => {
    if (sikiData?.jenjang) {
      const jenjangNum = parseInt(sikiData.jenjang, 10)
      const base = jenjangNum >= 7 ? 300000 : 100000
      setHargaBase(base)
      setHargaFinal(base - (base * diskonPersen / 100))
    }
  }, [sikiData?.jenjang, diskonPersen])

  const onSearch = async (data: FormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Direct API call to SIKI without saving to database
      const response = await fetch('/api/siki/get-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idIzin: data.idIzin }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        // More specific error messages
        let errorMessage = result.error || 'Gagal mengambil data dari SIKI'

        if (response.status === 400) {
          if (errorMessage.includes('ID Izin')) {
            errorMessage = '❌ ID Izin tidak valid. Pastikan ID Izin yang Anda masukkan benar.'
          } else if (errorMessage.includes('tidak ditemukan')) {
            errorMessage = '❌ Data tidak ditemukan di SIKI. Periksa kembali ID Izin Anda atau pastikan data Anda sudah terdaftar di SIKI.'
          } else {
            errorMessage = `❌ ${errorMessage}`
          }
        } else if (response.status === 401) {
          errorMessage = '❌ Sesi Anda telah berakhir. Silakan login kembali.'
        } else if (response.status === 500) {
          errorMessage = '❌ Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.'
        }

        setError(errorMessage)
      } else {
        setSikiData(result.data)
        setKtaRequestId(null) // Reset since not saved yet
      }
    } catch (error) {
      setError('❌ Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleZoom = (type: 'ktp' | 'foto' | 'compareKtp' | 'compareFoto', direction: 'in' | 'out') => {
    switch (type) {
      case 'ktp':
        setKtpZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
        break
      case 'foto':
        setFotoZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
        break
      case 'compareKtp':
        setCompareKtpZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
        break
      case 'compareFoto':
        setCompareFotoZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
        break
    }
  }

  const resetZoom = (type: 'ktp' | 'foto' | 'all') => {
    switch (type) {
      case 'ktp':
        setKtpZoom(1)
        break
      case 'foto':
        setFotoZoom(1)
        break
      case 'all':
        setKtpZoom(1)
        setFotoZoom(1)
        setCompareKtpZoom(1)
        setCompareFotoZoom(1)
        break
    }
  }

  const closeAllPreviews = () => {
    setKtpModalOpen(false)
    setFotoModalOpen(false)
    setSidebarCollapsed(false)
    setKtpZoom(1)
    setFotoZoom(1)
  }

  const handleDownload = (url: string, type: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `${type}-${Date.now()}`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const onSubmit = async () => {
    setIsLoading(true)

    try {
      // Validate required fields before submitting
      if (!sikiData.nik || !sikiData.nama) {
        setError('❌ NIK dan Nama harus diisi sebelum menyimpan.')
        return
      }

      // Save KTA request with edited data
      const response = await fetch('/api/kta/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idIzin: form.getValues().idIzin,
          sikiData: sikiData
        }),
      })

      const result = await response.json()

      if (response.ok) {
        router.push(`/dashboard/permohonan?success=true&nama=${encodeURIComponent(sikiData.nama)}`)
      } else {
        // More specific error messages
        let errorMessage = result.error || 'Gagal menyimpan permohonan'

        if (response.status === 400) {
          if (errorMessage.includes('ID Izin')) {
            errorMessage = '❌ ID Izin tidak ditemukan. Silakan cari ulang data SIKI.'
          } else if (errorMessage.includes('required')) {
            errorMessage = '❌ Data yang diperlukan tidak lengkap. Pastikan semua field terisi dengan benar.'
          } else {
            errorMessage = `❌ ${errorMessage}`
          }
        } else if (response.status === 401) {
          errorMessage = '❌ Sesi Anda telah berakhir. Silakan login kembali.'
        } else if (response.status === 500) {
          errorMessage = '❌ Terjadi kesalahan pada server saat menyimpan data. Silakan coba beberapa saat lagi.'
        }

        setError(errorMessage)
      }
    } catch (error) {
      setError('❌ Tidak dapat menyimpan data. Periksa koneksi internet Anda dan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn(
      'space-y-5 transition-all duration-300',
      (ktpModalOpen || fotoModalOpen) && 'pr-[480px]'
    )}>
      {/* Header - 3D Style */}
      <div className="animate-slide-up-stagger stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">Permohonan KTA Baru</h1>
        <p className="text-slate-500 text-sm">
          Masukkan ID Izin untuk mengambil data dari SIKI
        </p>
      </div>

      {/* Search Card - 3D Style */}
      <Card className="card-3d animate-slide-up-stagger stagger-2">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Search className="h-5 w-5 text-slate-700" />
            Cari Data SIKI
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={form.handleSubmit(onSearch)} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="idIzin" className="text-slate-700">ID Izin <span className="text-red-600">*</span></Label>
              <Input
                id="idIzin"
                placeholder="Contoh: 1234567890123456"
                {...form.register('idIzin')}
                disabled={isLoading || !!sikiData}
                className="bg-white"
              />
              <p className="text-xs text-slate-500">
                Masukkan 21 digit nomor ID Izin yang Anda dapatkan dari SIKI
              </p>
              {form.formState.errors.idIzin && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {form.formState.errors.idIzin.message}
                </p>
              )}
            </div>

            {!sikiData && (
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-md"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <PulseLogo className="scale-50" />
                  </span>
                ) : (
                  'Cari Data'
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {sikiData && (
        <>
          {/* Data Card - 3D Style */}
          <Card className="card-3d animate-slide-up-stagger stagger-3">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <User className="h-5 w-5 text-slate-700" />
                Data Pemohon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <Alert className="bg-sky-50 border-sky-200">
                <AlertCircle className="h-4 w-4 text-sky-600" />
                <AlertDescription className="text-sky-800 text-sm">
                  Data diambil dari SIKI. Data bersifat read-only dan tidak dapat diubah.
                </AlertDescription>
              </Alert>

              {/* ID Izin - Read-only display */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nik" className="text-slate-700">NIK</Label>
                  <Input
                    id="nik"
                    value={sikiData.nik}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="nama" className="text-slate-700">Nama Lengkap</Label>
                  <Input
                    id="nama"
                    value={sikiData.nama}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="jabatan" className="text-slate-700">Jabatan Kerja</Label>
                  <Input
                    id="jabatan"
                    value={sikiData.jabatan || ''}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="subklasifikasi" className="text-slate-700">Sub Klasifikasi</Label>
                  <Input
                    id="subklasifikasi"
                    value={
                      sikiData.klasifikasi
                        ? `${sikiData.klasifikasi.kodeSubklasifikasi} - ${sikiData.klasifikasi.subklasifikasi}`
                        : sikiData.subklasifikasi || ''
                    }
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="jenjang" className="text-slate-700">Jenjang</Label>
                  <Input
                    id="jenjang"
                    value={sikiData.jenjang || ''}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Jenjang diambil dari data SIKI</p>
                </div>
                <div>
                  <Label htmlFor="telp" className="text-slate-700">No. Telepon</Label>
                  <Input
                    id="telp"
                    value={sikiData.telp || ''}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="email" className="text-slate-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={sikiData.email || ''}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="alamat" className="text-slate-700">Alamat</Label>
                  <textarea
                    id="alamat"
                    value={sikiData.alamat || ''}
                    readOnly
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Document Previews - Simplified */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <Label className="text-sm font-medium text-slate-700">KTP</Label>
                  {sikiData.ktpUrl ? (
                    <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-sm text-emerald-700">Dokumen KTP tersedia</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">KTP tidak tersedia</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Pas Foto</Label>
                  {sikiData.fotoUrl ? (
                    <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-sm text-emerald-700">Pas Foto tersedia</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Pas foto tidak tersedia</p>
                  )}
                </div>
                {(sikiData.ktpUrl || sikiData.fotoUrl) && (
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300"
                      onClick={() => {
                        setKtpModalOpen(true)
                        setFotoModalOpen(true)
                        setSidebarCollapsed(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Bandingkan Dokumen
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Card - 3D Style */}
          <Card className="card-3d animate-slide-up-stagger stagger-4">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <CreditCard className="h-5 w-5 text-slate-700" />
                Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-4">
                {/* Jenjang Info */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Jenjang</Label>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {sikiData.jenjang || '-'}
                  </p>
                </div>

                {/* Price Breakdown */}
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

          {/* Action Buttons - Floating Bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl z-50 animate-slide-up">
            <div className="max-w-5xl mx-auto px-6 py-4">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSikiData(null)
                    setKtaRequestId(null)
                    form.reset()
                  }}
                  disabled={isLoading}
                  className="border-slate-300"
                >
                  Cari Ulang
                </Button>
                <Button
                  onClick={onSubmit}
                  disabled={isLoading}
                  className="flex-1 bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-md"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <PulseLogo className="scale-50" />
                    </span>
                  ) : (
                    'Ajukan Permohonan'
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Spacer for fixed bottom bar */}
          <div className="h-24" />
        </>
      )}

      {/* Floating Preview Panels */}
      {(ktpModalOpen || fotoModalOpen) && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-y-0 left-0 right-[444px] z-30"
            onClick={closeAllPreviews}
          />

          {/* Combined Preview Container */}
          <div className="fixed top-6 bottom-6 right-6 w-[420px] flex flex-col gap-0 z-40">
            {/* KTP Preview Panel - Top */}
            {ktpModalOpen && sikiData.ktpUrl && (
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
                    {sikiData.ktpUrl.toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={sikiData.ktpUrl}
                        className="w-full h-full"
                        title="Scan KTP PDF"
                      />
                    ) : (
                      <img
                        src={sikiData.ktpUrl}
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
            {ktpModalOpen && fotoModalOpen && (
              <div className="h-0" />
            )}

            {/* Pas Foto Preview Panel - Bottom */}
            {fotoModalOpen && sikiData.fotoUrl && (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={closeAllPreviews}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-3 bg-slate-100 overflow-auto">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full flex justify-center" style={{ transform: `scale(${fotoZoom})`, transformOrigin: 'top center' }}>
                    <img
                      src={sikiData.fotoUrl}
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
    </div>
  )
}