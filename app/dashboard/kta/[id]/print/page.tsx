'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { PulseLogo } from '@/components/ui/loading-spinner'

interface KTARequest {
  id: string
  idIzin: string
  nik: string
  nama: string
  jabatanKerja: string
  subKlasifikasi: string
  jenjang: string
  noTelp: string
  email: string
  alamat: string
  tanggalDaftar: string
  qrCodeUrl?: string
  fotoUrl?: string
}

export default function KTAPrintPage() {
  const params = useParams()
  const router = useRouter()
  const [ktaRequest, setKtaRequest] = useState<KTARequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    fetchKTARequest()
  }, [params.id])

  const fetchKTARequest = async () => {
    try {
      const response = await fetch(`/api/kta/${params.id}/print`)
      const result = await response.json()

      if (response.ok && result.success) {
        setKtaRequest(result.data)
      } else {
        setError(result.error || 'KTA not Terkonfirmasiing')
      }
    } catch (error) {
      setError('Failed to fetch KTA data')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/kta/${params.id}/generate-pdf`, {
        method: 'POST',
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KTA-${ktaRequest?.nama}-${params.id}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PulseLogo text="Memuat kartu..." />
      </div>
    )
  }

  if (!ktaRequest || error) {
    return (
      <div className="space-y-4 p-6">
        <Link href={`/dashboard/kta/${params.id}`}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        {error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Header - Hidden when printing */}
      <div className="bg-white shadow-sm border-b p-4 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href={`/dashboard/kta/${params.id}`}>
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </Link>
          <div className="flex gap-4">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Cetak
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* KTA Card */}
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          {/* Front of KTA Card */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8" id="kta-card-front">
            <div className="bg-gradient-to-r from-construction-500 to-construction-600 p-6">
              <div className="flex justify-between items-start text-white">
                <div>
                  <h1 className="text-2xl font-bold">KARTU TANDA ANGGOTA</h1>
                  <p className="text-sm opacity-90 mt-1">KTA LPJKN</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">No. Anggota</p>
                  <p className="font-mono text-lg">{params.id.slice(-8).toUpperCase()}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Photo */}
                <div className="col-span-1">
                  <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
                    {ktaRequest.fotoUrl && isClient ? (
                      <Image
                        src={ktaRequest.fotoUrl}
                        alt="Pas Foto"
                        width={200}
                        height={200}
                        className="rounded-lg object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-gray-400">Pas Foto</span>
                    )}
                  </div>
                </div>

                {/* Personal Info */}
                <div className="col-span-2 space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Nama Lengkap</p>
                    <p className="font-semibold text-lg">{ktaRequest.nama}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">NIK</p>
                    <p className="font-mono">{ktaRequest.nik}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ID Izin</p>
                    <p className="font-mono">{ktaRequest.idIzin}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Jabatan Kerja</p>
                    <p className="font-semibold">{ktaRequest.jabatanKerja}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Sub Klasifikasi</p>
                    <p className="font-semibold">{ktaRequest.subKlasifikasi}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Jenjang</p>
                    <p className="font-semibold">{ktaRequest.jenjang}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-gray-500">Berlaku Sejak</p>
                    <p className="font-semibold">
                      {new Date(ktaRequest.tanggalDaftar).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      {ktaRequest.qrCodeUrl && isClient ? (
                        <Image
                          src={ktaRequest.qrCodeUrl}
                          alt="QR Code"
                          width={128}
                          height={128}
                        />
                      ) : (
                        <span className="text-xs text-gray-400 text-center">QR Code<br/>Verification</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <div className="text-center text-sm text-gray-600">
                <p>Verifikasi keaslian kartu di: https://kta.lpjkn.id/verify/{ktaRequest.idIzin}</p>
              </div>
            </div>
          </div>

          {/* Back of KTA Card */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden" id="kta-card-back">
            <div className="bg-gradient-to-r from-construction-500 to-construction-600 p-6">
              <h2 className="text-xl font-bold text-white">INFORMASI ANGGOTA</h2>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Alamat</p>
                  <p className="font-semibold">{ktaRequest.alamat || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">No. Telepon</p>
                  <p className="font-semibold">{ktaRequest.noTelp || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-semibold">{ktaRequest.email || '-'}</p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">PETUNJUK PENGGUNAAN</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Kartu ini berlaku sebagai identitas resmi tenaga kerja konstruksi</li>
                  <li>• Wajib dibawa saat melaksanakan pekerjaan di proyek</li>
                  <li>• Scan QR code untuk verifikasi keabsahan kartu</li>
                  <li>• Laporkan kehilangan ke admin LPJKN terdekat</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          #kta-card-front, #kta-card-back {
            page-break-after: always;
            page-break-inside: avoid;
          }

          #kta-card-back {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  )
}