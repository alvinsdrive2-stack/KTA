'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, FileText, User, IdCard, Calendar, MapPin, Phone, Mail, Building } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useSession } from '@/hooks/useSession'

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
  const [kta, setKta] = useState<KTARequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

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
    if (!kta?.kartuGeneratedPath) {
      alert('PDF belum tersedia. Silakan generate PDF terlebih dahulu.')
      return
    }

    setDownloading(true)
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
        alert('Gagal mendownload PDF')
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Gagal mendownload PDF')
    } finally {
      setDownloading(false)
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

      {/* No. KTA Card */}
      {kta.nomorKTA && (
        <Card className="card-3d bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Nomor KTA</p>
                <p className="text-3xl font-bold font-mono tracking-wider">{kta.nomorKTA}</p>
              </div>
              <IdCard className="h-12 w-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                disabled={!kta.kartuGeneratedPath || downloading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {downloading ? (
                  <>Downloading...</>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
              {!kta.kartuGeneratedPath && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  PDF belum tersedia
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
