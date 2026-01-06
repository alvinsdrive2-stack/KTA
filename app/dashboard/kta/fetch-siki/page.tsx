'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Search, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'

export default function FetchSikiPage() {
  const router = useRouter()
  const [idIzin, setIdIzin] = useState('')
  const [loading, setLoading] = useState(false)
  const [sikiData, setSikiData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleFetch = async () => {
    if (!idIzin.trim()) {
      setError('ID Izin harus diisi')
      return
    }

    setLoading(true)
    setError(null)
    setSikiData(null)

    try {
      const response = await fetch('/api/kta/fetch-siki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idIzin }),
      })

      const data = await response.json()

      if (data.success) {
        setSikiData(data.data)
        setSuccess(true)
      } else {
        setError(data.error || 'Gagal mengambil data dari SIKI')
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    if (sikiData) {
      router.push(`/dashboard/kta/edit/${sikiData.id}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="animate-slide-up-stagger stagger-1">
        <h1 className="text-3xl font-bold">Fetch Data dari SIKI</h1>
        <p className="text-gray-600">
          Ambil data anggota dari Sistem Informasi Keahlian Konstruksi (SIKI)
        </p>
      </div>

      <Card className="card-3d animate-slide-up-stagger stagger-2">
        <CardHeader>
          <CardTitle>Masukkan ID Izin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idIzin">ID Izin SIKI</Label>
            <div className="flex space-x-2">
              <Input
                id="idIzin"
                placeholder="Contoh: SKK-2024-001"
                value={idIzin}
                onChange={(e) => setIdIzin(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleFetch()}
              />
              <Button
                onClick={handleFetch}
                disabled={loading || !idIzin.trim()}
                className="bg-construction-500 hover:bg-construction-600"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <PulseLogo className="scale-50" />
                    <span>Memuat...</span>
                  </span>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Fetch Data
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {sikiData && (
        <Card className="card-3d animate-slide-up-stagger stagger-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Data Berhasil Diambil</CardTitle>
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Valid
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Nama</Label>
                <p className="font-semibold">{sikiData.nama}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">NIK</Label>
                <p className="font-semibold">{sikiData.nik}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Jabatan</Label>
                <p className="font-semibold">{sikiData.jabatan}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Subklasifikasi</Label>
                <p className="font-semibold">{sikiData.subklasifikasi}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Jenjang</Label>
                <p className="font-semibold">{sikiData.jenjang}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">No. Telepon</Label>
                <p className="font-semibold">{sikiData.telp}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Email</Label>
                <p className="font-semibold">{sikiData.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Tanggal Daftar</Label>
                <p className="font-semibold">
                  {new Date(sikiData.tanggalDaftar).toLocaleDateString('id-ID')}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <Label className="text-sm font-medium text-gray-500">Alamat</Label>
              <p className="font-semibold">{sikiData.alamat}</p>
            </div>

            <Separator className="my-4" />

            <Button onClick={handleContinue} className="w-full">
              Lanjutkan Edit Data
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}