'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Upload, IdCard, Camera, User, CheckCircle, Loader2, AlertCircle, Send } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import { useSession } from '@/hooks/useSession'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface ImportedKTA {
  id: string
  idIzin: string
  nik: string
  nama: string
  jenjang: string
  jabatanKerja: string
  subklasifikasi: string
  noTelp: string
  ktpUrl?: string
  fotoUrl?: string
}

export default function ImportResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session } = useSession()
  const { toast } = useToast()

  const [importedData, setImportedData] = useState<ImportedKTA[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingDocs, setUploadingDocs] = useState<{ id: string; type: 'ktp' | 'foto' } | null>(null)
  const [pushingAsEnrol, setPushingAsEnrol] = useState(false)
  const [showKeteranganModal, setShowKeteranganModal] = useState(false)
  const [keterangan, setKeterangan] = useState('')

  // Get imported IDs from URL params
  const idsParam = searchParams.get('ids')

  useEffect(() => {
    if (idsParam) {
      fetchImportedData(idsParam.split(','))
    }
  }, [idsParam])

  const fetchImportedData = async (ids: string[]) => {
    try {
      setLoading(true)
      // Fetch each KTA by ID
      const promises = ids.map(id =>
        fetch(`/api/kta/${id}`).then(res => res.json())
      )

      const results = await Promise.all(promises)
      const validData = results
        .filter(r => r.success)
        .map(r => r.data)

      setImportedData(validData)
    } catch (error) {
      console.error('Error fetching imported data:', error)
      toast({
        variant: 'destructive',
        title: 'Gagal memuat data',
        description: 'Terjadi kesalahan saat memuat data yang diimpor',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUploadDocument = async (ktaId: string, nama: string, type: 'ktp' | 'foto') => {
    setCurrentDocUpload({ id: ktaId, type })
    setUploadingDocs({ id: ktaId, type })

    try {
      // Create file input
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = type === 'ktp' ? 'image/*,.pdf' : 'image/*'

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          setUploadingDocs(null)
          return
        }

        // Validate file size
        if (file.size > 5 * 1024 * 1024) {
          toast({
            variant: 'destructive',
            title: 'File terlalu besar',
            description: 'Ukuran file maksimal 5MB',
          })
          setUploadingDocs(null)
          return
        }

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

          // Update KTA with document URL
          const updateResponse = await fetch(`/api/kta/${ktaId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              [type === 'ktp' ? 'ktpUrl' : 'fotoUrl']: uploadData.url,
              status: 'DRAFT',
            }),
          })

          if (!updateResponse.ok) {
            throw new Error('Gagal mengupdate data KTA')
          }

          toast({
            variant: 'success',
            title: 'Upload Berhasil',
            description: `${type === 'ktp' ? 'KTP' : 'Foto'} berhasil diupload untuk ${nama}`,
          })

          // Refresh data
          if (idsParam) {
            fetchImportedData(idsParam.split(','))
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Upload Gagal',
            description: error instanceof Error ? error.message : 'Terjadi kesalahan',
          })
        } finally {
          setUploadingDocs(null)
        }
      }

      input.click()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload Gagal',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      })
      setUploadingDocs(null)
    }
  }

  const handlePushAsEnrol = () => {
    if (!idsParam) return

    const ids = idsParam.split(',')
    const incompleteCount = importedData.filter(item => !hasBothDocs(item)).length

    if (incompleteCount > 0) {
      toast({
        variant: 'destructive',
        title: 'Dokumen Belum Lengkap',
        description: `${incompleteCount} data belum memiliki KTP dan Pas Foto lengkap.`,
      })
      return
    }

    // Show keterangan modal
    setShowKeteranganModal(true)
  }

  const handleConfirmPushAsEnrol = async () => {
    if (!keterangan.trim()) {
      toast({
        variant: 'destructive',
        title: 'Keterangan Wajib Diisi',
        description: 'Silakan isi keterangan untuk push enrol.',
      })
      return
    }

    if (!idsParam) return

    const ids = idsParam.split(',')
    setPushingAsEnrol(true)
    setShowKeteranganModal(false)

    try {
      // Push all KTAs as enrol in a single request
      const response = await fetch('/api/kta/push-enrol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, keterangan }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal push sebagai enrol')
      }

      toast({
        variant: 'success',
        title: 'Berhasil Push sebagai Enrol',
        description: result.message || `${ids.length} data berhasil dikirim ke Keuangan untuk konfirmasi.`,
      })
      router.push('/dashboard/permohonan')
    } catch (error) {
      console.error('Error pushing as enrol:', error)
      toast({
        variant: 'destructive',
        title: 'Gagal Push sebagai Enrol',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      })
    } finally {
      setPushingAsEnrol(false)
      setKeterangan('')
    }
  }

  const setCurrentDocUpload = (data: { id: string; type: 'ktp' | 'foto' }) => {
    // This function just sets state for the current document being uploaded
    console.log('Setting current doc upload:', data)
  }

  const isUploading = (id: string, type: 'ktp' | 'foto') => {
    return uploadingDocs?.id === id && uploadingDocs?.type === type
  }

  const hasBothDocs = (item: ImportedKTA) => {
    return !!item.ktpUrl && !!item.fotoUrl
  }

  const getCompletionCount = () => {
    return importedData.filter(item => hasBothDocs(item)).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data import..." />
      </div>
    )
  }

  if (importedData.length === 0) {
    return (
      <div className="space-y-6">
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
            <h1 className="text-2xl font-semibold text-slate-900">Hasil Import KTA</h1>
            <p className="text-slate-500 text-sm">Upload dokumen KTP dan Pas Foto</p>
          </div>
        </div>

        <Card className="card-3d">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Tidak ada data yang ditemukan</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/dashboard/permohonan')}
            >
              Kembali ke Daftar Permohonan
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up-stagger stagger-1">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/permohonan')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Hasil Import KTA</h1>
            <p className="text-slate-500 text-sm">Upload dokumen KTP dan Pas Foto untuk melanjutkan</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-slate-500">Dokumen Lengkap</p>
            <p className="text-2xl font-bold text-emerald-600">{getCompletionCount()}/{importedData.length}</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="card-3d bg-amber-50 border-amber-200 animate-slide-up-stagger stagger-2">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Upload className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Upload Dokumen Wajib</p>
              <p className="text-sm text-amber-700">
                KTP dan Pas Foto harus diupload untuk melanjutkan proses KTA. Klik tombol upload di setiap baris untuk mengupload dokumen.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="card-3d animate-slide-up-stagger stagger-3">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="text-base font-semibold text-slate-900">
            Data yang Diimpor ({importedData.length} data)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Nama Lengkap</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">NIK</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Kualifikasi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Jabatan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Subklasifikasi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">No. Telepon</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">KTP</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Pas Foto</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {importedData.map((item, idx) => {
                  const hasKtp = !!item.ktpUrl
                  const hasFoto = !!item.fotoUrl
                  const complete = hasKtp && hasFoto

                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-slate-100 ${complete ? 'bg-emerald-50' : 'bg-white'}`}
                    >
                      <td className="px-4 py-3 text-sm text-slate-600">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="font-medium text-slate-900">{item.nama}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600">{item.nik}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-blue-200 text-blue-700">
                          {item.jenjang}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.jabatanKerja}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.subklasifikasi}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.noTelp}</td>

                      {/* KTP Column */}
                      <td className="px-4 py-3 text-center">
                        {hasKtp ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => window.open(item.ktpUrl, '_blank')}
                            >
                              Lihat
                            </Button>
                          </div>
                        ) : isUploading(item.id, 'ktp') ? (
                          <Loader2 className="h-5 w-5 text-slate-400 mx-auto animate-spin" />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => handleUploadDocument(item.id, item.nama, 'ktp')}
                          >
                            <IdCard className="h-4 w-4 mr-1" />
                            Upload KTP
                          </Button>
                        )}
                      </td>

                      {/* Foto Column */}
                      <td className="px-4 py-3 text-center">
                        {hasFoto ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                            {item.fotoUrl && (
                              <div className="w-8 h-10 rounded overflow-hidden border border-slate-200">
                                <img
                                  src={item.fotoUrl}
                                  alt={item.nama}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        ) : isUploading(item.id, 'foto') ? (
                          <Loader2 className="h-5 w-5 text-slate-400 mx-auto animate-spin" />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => handleUploadDocument(item.id, item.nama, 'foto')}
                          >
                            <Camera className="h-4 w-4 mr-1" />
                            Upload Foto
                          </Button>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-4 py-3 text-center">
                        {complete ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            Lengkap
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            Kurang
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <Card className="card-3d animate-slide-up-stagger stagger-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {getCompletionCount()} dari {importedData.length} data sudah lengkap
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/permohonan')}
                disabled={pushingAsEnrol}
              >
                Kembali ke Daftar
              </Button>
              {getCompletionCount() === importedData.length && (
                <>
                  {session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN' ? (
                    <>
                      <Button
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => router.push('/dashboard/permohonan')}
                        disabled={pushingAsEnrol}
                      >
                        Lanjut ke Daftar Permohonan
                      </Button>
                      <Button
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={handlePushAsEnrol}
                        disabled={pushingAsEnrol}
                      >
                        {pushingAsEnrol ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Memproses...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Push sebagai Enrol
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => router.push('/dashboard/permohonan')}
                    >
                      Lanjut ke Daftar Permohonan
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          {(session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN') && getCompletionCount() === importedData.length && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                <strong>Push sebagai Enrol:</strong> Lewati proses pembayaran dan langsung minta konfirmasi ke Keuangan.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keterangan Modal */}
      <Dialog open={showKeteranganModal} onOpenChange={setShowKeteranganModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push sebagai Enrol</DialogTitle>
            <DialogDescription>
              Masukkan keterangan untuk enrolment ini. Data akan dilewati dari proses pembayaran dan langsung dikirim ke Keuangan untuk konfirmasi (status: READY_FOR_PUSAT).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Contoh: Enrolment peserta pelatihan batch 123, gratis karena sponsored..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={4}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowKeteranganModal(false)
                setKeterangan('')
              }}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmPushAsEnrol}
              disabled={!keterangan.trim() || pushingAsEnrol}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {pushingAsEnrol ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Push sebagai Enrol
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
