'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageTransition } from '@/components/ui/page-transition'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import {
  Search,
  Upload,
  FileCheck,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  X,
} from 'lucide-react'

const FIELD_OPTIONS = [
  { key: 'nama', label: 'Nama Lengkap' },
  { key: 'nik', label: 'NIK' },
  { key: 'jabatanKerja', label: 'Jabatan Kerja' },
  { key: 'jenjang', label: 'Kualifikasi' },
  { key: 'noTelp', label: 'No. Telepon' },
  { key: 'email', label: 'Email' },
  { key: 'alamat', label: 'Alamat' },
  { key: 'subklasifikasi', label: 'Subklasifikasi' },
]

interface KTAOption {
  id: string
  nama: string
  nik: string
  idIzin: string | null
  nomorKTA: string | null
  daerah: { namaDaerah: string; kodeDaerah: string }
}

interface BarisBanding {
  field: string
  label: string
  hint: string | null
  sikiValue: string | null
  currentValue: string | null
  bisaDibanding: boolean
  beda: boolean
}

interface HasilPreview {
  idIzin: string
  perbandingan: BarisBanding[]
  siki: Record<string, string | null>
  ktaDitemukan: boolean
}

interface RiwayatItem {
  id: string
  fieldName: string
  oldValue: string | null
  newValue: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  catatan: string | null
  createdAt: string
  ktaRequest: { id: string; nama: string; nik: string; nomorKTA: string | null }
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu Konfirmasi',
  APPROVED: 'Diterima',
  REJECTED: 'Ditolak',
}

export default function PermohonanPerubahanPage() {
  const { session } = useSession()
  const { toast } = useToast()

  const [akses, setAkses] = useState<'menunggu' | 'boleh' | 'ditolak'>('menunggu')
  const initialCheckDone = useRef(false)

  // Pilih KTA
  const [cari, setCari] = useState('')
  const [mencari, setMencari] = useState(false)
  const [hasilCari, setHasilCari] = useState<KTAOption[]>([])
  const [ktaTerpilih, setKtaTerpilih] = useState<KTAOption | null>(null)

  // Preview SIKI
  const [idIzin, setIdIzin] = useState('')
  const [preview, setPreview] = useState<HasilPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Form permohonan
  const [field, setField] = useState('')
  const [nilaiBaru, setNilaiBaru] = useState('')
  const [alasan, setAlasan] = useState('')
  const [buktiUrl, setBuktiUrl] = useState('')
  const [namaBukti, setNamaBukti] = useState('')
  const [mengunggah, setMengunggah] = useState(false)
  const [mengirim, setMengirim] = useState(false)
  const [errorKirim, setErrorKirim] = useState<string | null>(null)

  // Riwayat
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([])
  const [loadingRiwayat, setLoadingRiwayat] = useState(false)

  const muatRiwayat = useCallback(async () => {
    setLoadingRiwayat(true)
    try {
      const res = await fetch('/api/kta/change-request?limit=10')
      const data = await res.json()
      if (data.success) setRiwayat(data.data)
    } catch (err) {
      console.error('Gagal muat riwayat:', err)
    } finally {
      setLoadingRiwayat(false)
    }
  }, [])

  // Gerbang akses: cuma BPP (PUSAT) yang boleh buka.
  useEffect(() => {
    if (session === null || session === undefined) return
    if (initialCheckDone.current) return
    initialCheckDone.current = true

    if (session.user?.role === 'PUSAT') {
      setAkses('boleh')
      muatRiwayat()
    } else {
      setAkses('ditolak')
    }
  }, [session, muatRiwayat])

  const cariKTA = async () => {
    const q = cari.trim()
    if (!q) return
    setMencari(true)
    try {
      const res = await fetch(
        `/api/kta/list?search=${encodeURIComponent(q)}&limit=10`
      )
      const data = await res.json()
      if (data.success) {
        setHasilCari(data.data)
        if (data.data.length === 0) {
          toast({ title: 'Nggak ketemu', description: 'Nggak ada KTA yang cocok.' })
        }
      }
    } catch (err) {
      console.error('Cari KTA error:', err)
      toast({ variant: 'destructive', title: 'Gagal nyari KTA' })
    } finally {
      setMencari(false)
    }
  }

  const pilihKTA = (kta: KTAOption) => {
    setKtaTerpilih(kta)
    setHasilCari([])
    setCari('')
    // ID Izin KTA-nya langsung diisikan sebagai titik awal — BPP masih bisa
    // ngganti kalau mau bandingin sama izin yang lain.
    setIdIzin(kta.idIzin || '')
    setPreview(null)
    setPreviewError(null)
  }

  const lihatPerbedaan = async () => {
    const izin = idIzin.trim()
    if (!izin) {
      setPreviewError('Isi ID Izin dulu')
      return
    }
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const res = await fetch('/api/kta/change-request/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idIzin: izin,
          ktaRequestId: ktaTerpilih?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setPreviewError(data.error || 'Gagal ambil data pembanding')
        setPreview(null)
        return
      }
      setPreview(data.data)
    } catch (err) {
      console.error('Preview error:', err)
      setPreviewError('Gagal ambil data pembanding dari SIKI')
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  /**
   * BPP klik baris yang beda -> field dan nilai barunya langsung keisi dari
   * data SIKI. Tetap bisa diedit manual, karena SIKI bukan satu-satunya sumber
   * kebenaran (misal subklasifikasi yang di SIKI isinya kode).
   */
  const pakaiNilaiSIKI = (baris: BarisBanding) => {
    setField(baris.field)
    setNilaiBaru(baris.sikiValue ?? '')
  }

  const unggahBukti = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setMengunggah(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', 'bukti-perubahan')

      const res = await fetch('/api/upload/document', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || !data.success) {
        toast({
          variant: 'destructive',
          title: 'Upload gagal',
          description: data.error || 'Coba file lain.',
        })
        return
      }

      setBuktiUrl(data.url)
      setNamaBukti(file.name)
    } catch (err) {
      console.error('Upload bukti error:', err)
      toast({ variant: 'destructive', title: 'Upload gagal' })
    } finally {
      setMengunggah(false)
      e.target.value = ''
    }
  }

  const ajukan = async () => {
    setErrorKirim(null)

    if (!ktaTerpilih) {
      setErrorKirim('Pilih KTA yang mau diubah dulu')
      return
    }
    if (!field) {
      setErrorKirim('Pilih field yang mau diubah')
      return
    }
    if (!nilaiBaru.trim()) {
      setErrorKirim('Isi nilai barunya')
      return
    }
    if (!alasan.trim()) {
      setErrorKirim('Isi alasan permohonannya')
      return
    }
    if (!buktiUrl) {
      setErrorKirim('Upload bukti permohonannya dulu')
      return
    }

    setMengirim(true)
    try {
      const res = await fetch('/api/kta/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ktaRequestId: ktaTerpilih.id,
          fieldName: field,
          newValue: nilaiBaru.trim(),
          reason: alasan.trim(),
          buktiUrl,
          idIzinInput: idIzin.trim() || null,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setErrorKirim(data.error || 'Permohonan gagal dikirim')
        return
      }

      toast({
        variant: 'success',
        title: 'Permohonan terkirim',
        description: 'Nunggu konfirmasi Keuangan.',
      })

      // Reset form, tapi KTA yang dipilih dibiarkan — biasanya BPP ngajuin
      // beberapa perubahan berurutan buat anggota yang sama.
      setField('')
      setNilaiBaru('')
      setAlasan('')
      setBuktiUrl('')
      setNamaBukti('')
      setPreview(null)
      muatRiwayat()
    } catch (err) {
      console.error('Ajukan error:', err)
      setErrorKirim('Terjadi kesalahan saat mengirim permohonan')
    } finally {
      setMengirim(false)
    }
  }

  if (akses === 'menunggu') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo />
      </div>
    )
  }

  if (akses === 'ditolak') {
    return (
      <PageTransition>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Halaman ini khusus buat BPP. Role kamu nggak punya akses.
            </AlertDescription>
          </Alert>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Permohonan Perubahan KTA
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ajukan perubahan satu field data KTA. Permohonan masuk ke Keuangan
            buat dikonfirmasi.
          </p>
        </div>

        {/* ---------------- Langkah 1: pilih KTA ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Pilih KTA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ktaTerpilih ? (
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-blue-200 bg-blue-50">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-800">{ktaTerpilih.nama}</p>
                  <p className="text-sm text-slate-600">
                    NIK {ktaTerpilih.nik} · {ktaTerpilih.daerah.namaDaerah}
                  </p>
                  <p className="text-xs text-slate-500">
                    ID Izin: {ktaTerpilih.idIzin || '—'} · No. KTA:{' '}
                    {ktaTerpilih.nomorKTA || 'belum terbit'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setKtaTerpilih(null)
                    setPreview(null)
                    setIdIzin('')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Cari nama, NIK, atau ID Izin..."
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && cariKTA()}
                  />
                  <Button onClick={cariKTA} disabled={mencari}>
                    {mencari ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {hasilCari.length > 0 && (
                  <div className="divide-y rounded-lg border max-h-72 overflow-y-auto">
                    {hasilCari.map((kta) => (
                      <button
                        key={kta.id}
                        onClick={() => pilihKTA(kta)}
                        className="w-full text-left p-3 hover:bg-slate-50 transition-colors"
                      >
                        <p className="font-medium text-slate-800 text-sm">{kta.nama}</p>
                        <p className="text-xs text-slate-500">
                          NIK {kta.nik} · {kta.daerah.namaDaerah}
                          {kta.nomorKTA ? ` · ${kta.nomorKTA}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ---------------- Langkah 2: ID Izin + pembanding ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. ID Izin{' '}
              <span className="font-normal text-slate-400">(opsional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              Isi ID Izin buat lihat bedanya data SIKI sama data di sistem.
              Kosongin kalau nggak perlu bandingin.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="ID Izin dari SIKI"
                value={idIzin}
                onChange={(e) => setIdIzin(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={lihatPerbedaan}
                disabled={loadingPreview || !idIzin.trim()}
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Lihat Perbedaan'
                )}
              </Button>
            </div>

            {previewError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
            )}

            {preview && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Info className="h-4 w-4" />
                  <span>
                    {preview.perbandingan.filter((b) => b.beda).length} field beda
                    {!preview.ktaDitemukan && ' · pembanding KTA belum dipilih'}
                  </span>
                </div>

                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="text-left p-3 font-semibold">Field</th>
                        <th className="text-left p-3 font-semibold">Di Sistem</th>
                        <th className="text-left p-3 font-semibold">Di SIKI</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.perbandingan.map((b) => (
                        <tr
                          key={b.field}
                          className={b.beda ? 'bg-amber-50' : undefined}
                        >
                          <td className="p-3 font-medium text-slate-700">{b.label}</td>
                          <td className="p-3 text-slate-600">
                            {b.currentValue ?? '—'}
                          </td>
                          <td className="p-3 text-slate-600">
                            {b.sikiValue ?? (
                              <span className="text-slate-400">nggak ada di SIKI</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {b.beda && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => pakaiNilaiSIKI(b)}
                              >
                                Pakai
                              </Button>
                            )}
                            {!b.beda && b.bisaDibanding && (
                              <CheckCircle className="h-4 w-4 text-green-500 inline" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------- Langkah 3: form permohonan ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Detail Perubahan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Field yang diubah</Label>
              <div className="flex flex-wrap gap-2">
                {FIELD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setField(opt.key)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      field === opt.key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nilaiBaru">Nilai baru</Label>
              <Input
                id="nilaiBaru"
                value={nilaiBaru}
                onChange={(e) => setNilaiBaru(e.target.value)}
                placeholder="Nilai yang seharusnya"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alasan">Alasan permohonan</Label>
              <Textarea
                id="alasan"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Kenapa data ini perlu diubah..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Bukti permohonan</Label>
              {buktiUrl ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    {namaBukti || 'File terunggah'}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBuktiUrl('')
                      setNamaBukti('')
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={unggahBukti}
                    disabled={mengunggah}
                  />
                  {mengunggah ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      <span className="text-sm text-slate-500">Mengunggah...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        Pilih surat/scan permohonan (JPG, PNG, WebP, atau PDF)
                      </span>
                    </>
                  )}
                </label>
              )}
            </div>

            {errorKirim && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorKirim}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={ajukan}
              disabled={mengirim}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {mengirim ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mengirim...
                </>
              ) : (
                'Kirim Permohonan'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ---------------- Riwayat ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Permohonan</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRiwayat ? (
              <div className="flex justify-center py-8">
                <PulseLogo />
              </div>
            ) : riwayat.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Belum ada permohonan.
              </p>
            ) : (
              <div className="divide-y">
                {riwayat.map((r) => (
                  <div key={r.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">
                        {r.ktaRequest.nama}
                        <span className="font-normal text-slate-400">
                          {' '}
                          ·{' '}
                          {FIELD_OPTIONS.find((f) => f.key === r.fieldName)?.label ??
                            r.fieldName}
                        </span>
                      </p>
                      <Badge className={STATUS_STYLE[r.status]}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {r.oldValue || '(kosong)'} → {r.newValue}
                    </p>
                    {r.catatan && (
                      <p className="text-xs text-slate-500 italic">
                        Catatan Keuangan: {r.catatan}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
