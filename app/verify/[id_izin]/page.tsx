import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Construction, CheckCircle, XCircle, Clock, MapPin, Phone, Mail } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface PageProps {
  params: {
    id_izin: string
  }
}

async function getKTAData(idIzin: string) {
  try {
    // Use dynamic base URL to handle different ports
    const baseUrl = process.env.NEXTAUTH_URL ||
                   (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3004')
    const response = await fetch(`${baseUrl}/api/qr/${idIzin}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching KTA data:', error)
    return null
  }
}

export default async function VerifyPage({ params }: PageProps) {
  const result = await getKTAData(params.id_izin)

  if (!result?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="container mx-auto px-4">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <CardTitle className="text-2xl text-gray-900">Permohonan Tidak Ditemukan</CardTitle>
              <CardDescription>
                Permohonan dengan ID Izin tersebut tidak ada, pastikan ID Izin valid.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>ID Izin:</strong> {params.id_izin}
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>💡 <strong>Mungkin ini penyebabnya:</strong></p>
                  <ul className="text-left space-y-1 ml-4">
                    <li>• ID Izin yang dimasukkan salah</li>
                    <li>• Permohonan KTA belum diajukan</li>
                    <li>• Permohonan masih dalam proses verifikasi</li>
                    <li>• QR Code yang discan tidak valid</li>
                  </ul>
                </div>
                <Link href="/" className="inline-flex items-center gap-2">
                  <Button className="bg-construction-500 hover:bg-construction-600">
                    Kembali ke Beranda
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { data } = result

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRINTED':
      case 'READY_TO_PRINT':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'APPROVED_BY_PUSAT':
        return <CheckCircle className="h-5 w-5 text-blue-500" />
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRINTED':
      case 'READY_TO_PRINT':
        return 'bg-green-100 text-green-800'
      case 'APPROVED_BY_PUSAT':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="p-2 bg-construction-500 rounded-full">
              <Construction className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">KTA System</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Verifikasi Kartu Tanda Anggota
          </h1>
          <p className="text-gray-600">
            Scan QR Code untuk memverifikasi keabsahan KTA
          </p>
        </div>

        {/* Verification Result */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(data.status)}
                Hasil Verifikasi
              </CardTitle>
              <Badge className={getStatusColor(data.status)}>
                {data.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <CardDescription>
              ID Izin: {data.idIzin}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.status === 'APPROVED_BY_PUSAT' || data.status === 'READY_TO_PRINT' || data.status === 'PRINTED' ? (
              <div className="space-y-6">
                {/* Profile Section */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Data Anggota</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-500">Nama Lengkap</span>
                        <p className="font-medium">{data.nama}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">NIK</span>
                        <p className="font-medium">{data.nik}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Jabatan Kerja</span>
                        <p className="font-medium">{data.jabatanKerja}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Subklasifikasi</span>
                        <p className="font-medium">{data.subklasifikasi}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Jenjang</span>
                        <p className="font-medium">{data.jenjang}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">Informasi KTA</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-500">Daerah</span>
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {data.daerah}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Tanggal Terbit</span>
                        <p className="font-medium">
                          {new Date(data.tanggalTerbit).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Total Scan</span>
                        <p className="font-medium">{data.totalScans} kali</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* QR Code Section */}
                {data.qrCodePath && (
                  <div className="text-center">
                    <h3 className="font-semibold text-lg mb-3">QR Code Verifikasi</h3>
                    <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
                      <Image
                        src={data.qrCodePath}
                        alt="QR Code KTA"
                        width={200}
                        height={200}
                        className="mx-auto"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Scan QR Code untuk verifikasi ulang
                    </p>
                  </div>
                )}

                {/* Download Section */}
                {data.kartuGeneratedPath && data.status === 'PRINTED' && (
                  <div className="text-center">
                    <Button asChild className="bg-construction-500 hover:bg-construction-600">
                      <Link href={data.kartuGeneratedPath} target="_blank" download>
                        Download KTA PDF
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  KTA Tidak Valid
                </h3>
                <p className="text-gray-600">
                  KTA ini belum disetujui atau sudah tidak berlaku.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan History */}
        {data.recentScans && data.recentScans.length > 0 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Riwayat Scan</CardTitle>
              <CardDescription>10 scan terakhir</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.recentScans.map((scan: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">Scan #{index + 1}</span>
                      <div className="text-xs text-gray-500">
                        {scan.ipAddress} • {new Date(scan.scannedAt).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-600">
          <p>
            Powered by{' '}
            <span className="font-semibold">KTA Management System</span>
          </p>
          <p className="mt-1">
            Terakhir diperbarui: {new Date().toLocaleString('id-ID')}
          </p>
        </div>
      </div>
    </div>
  )
}