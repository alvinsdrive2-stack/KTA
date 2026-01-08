'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Upload, CreditCard, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'

interface KTARequest {
  id: string
  idIzin: string
  nama: string
  nik: string
  jabatanKerja: string
  status: string
  createdAt: string
  daerah?: {
    namaDaerah: string
    kodeDaerah: string
  }
}

export default function PaymentPage() {
  const { session } = useSession()
  const { toast } = useToast()
  const router = useRouter()
  const [selectedRequests, setSelectedRequests] = useState<KTARequest[]>([])
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [regionPrice, setRegionPrice] = useState<number | null>(null)

  useEffect(() => {
    // Get selected requests from localStorage or URL params
    const stored = localStorage.getItem('selectedKTARequests')
    if (stored) {
      setSelectedRequests(JSON.parse(stored))
    } else {
      // If no selected requests, redirect back
      router.push('/dashboard/permohonan')
      return
    }

    // Fetch region price
    const fetchRegionPrice = async () => {
      try {
        const response = await fetch('/api/daerah/price')
        const data = await response.json()
        if (data.success) {
          setRegionPrice(data.price)
        }
      } catch (error) {
        console.error('Failed to fetch region price:', error)
      }
    }

    fetchRegionPrice()
    setLoading(false)
  }, [router])

  const calculateTotal = () => {
    if (!regionPrice) return 0
    return selectedRequests.length * regionPrice
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type and size
      if (!file.type.match(/image\/(jpeg|jpg|png)/) && !file.type.includes('pdf')) {
        setError('Hanya menerima file JPG, JPEG, PNG, atau PDF')
        return
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Ukuran file maksimal 5MB')
        return
      }

      setPaymentProof(file)
      setError(null)
    }
  }

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentProof || selectedRequests.length === 0) {
      setError('Harap pilih file bukti pembayaran')
      return
    }

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('paymentProof', paymentProof)
    formData.append('requestIds', JSON.stringify(selectedRequests.map(req => req.id)))

    try {
      const response = await fetch('/api/kta/bulk-payment', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Clear stored requests
        localStorage.removeItem('selectedKTARequests')

        // Show success message and redirect
        toast({
          variant: 'success',
          title: 'Pembayaran Berhasil',
          description: 'Invoice telah dibuat untuk diverifikasi oleh Pusat'
        })
        setTimeout(() => router.push('/dashboard/permohonan'), 1000)
      } else {
        setError(result.error || 'Gagal mengupload pembayaran')
      }
    } catch (error) {
      setError('Terjadi kesalahan saat mengupload pembayaran')
    } finally {
      setUploading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      FETCHED_FROM_SIKI: 'bg-blue-100 text-blue-800',
      EDITED: 'bg-yellow-100 text-yellow-800',
      WAITING_PAYMENT: 'bg-orange-100 text-orange-800',
      READY_FOR_PUSAT: 'bg-purple-100 text-purple-800',
      APPROVED_BY_PUSAT: 'bg-green-100 text-green-800',
      READY_TO_PRINT: 'bg-cyan-100 text-cyan-800',
      PRINTED: 'bg-emerald-100 text-emerald-800',
      REJECTED: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulseLogo text="Memuat data..." />
      </div>
    )
  }

  if (selectedRequests.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/permohonan">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Tidak ada permohonan KTA yang dipilih. Silakan pilih permohonan terlebih dahulu.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 animate-slide-up-stagger stagger-1">
        <Link href="/dashboard/permohonan">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Pembayaran KTA</h1>
          <p className="text-gray-600">
            Upload bukti pembayaran untuk {selectedRequests.length} permohonan KTA
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selected Requests */}
        <div className="lg:col-span-2 animate-slide-up-stagger stagger-2">
          <Card className="card-3d">
            <CardHeader>
              <CardTitle>Permohonan yang Dipilih ({selectedRequests.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedRequests.map((request, index) => (
                  <div key={request.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{index + 1}. {request.nama}</p>
                        <p className="text-sm text-gray-600">ID Izin: {request.idIzin}</p>
                        <p className="text-sm text-gray-600">NIK: {request.nik}</p>
                        <p className="text-sm text-gray-600">Jabatan: {request.jabatanKerja}</p>
                        {request.daerah && (
                          <p className="text-sm text-gray-600">
                            Daerah: {request.daerah.namaDaerah} ({request.daerah.kodeDaerah})
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(request.status)}>
                          {request.status.replace(/_/g, ' ')}
                        </Badge>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          Rp {regionPrice?.toLocaleString('id-ID') || '...'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Form */}
        <div className="animate-slide-up-stagger stagger-3">
          <Card className="card-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Detail Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitPayment} className="space-y-4">
                {/* Total Payment */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Jumlah Permohonan</p>
                  <p className="text-2xl font-bold">{selectedRequests.length} KTA</p>
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-sm text-gray-600">Total Pembayaran</p>
                    <p className="text-3xl font-bold text-green-600">
                      Rp {calculateTotal().toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                {/* Payment Proof Upload */}
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
                  <p className="text-xs text-gray-500 mt-1">
                    Format: JPG, JPEG, PNG, PDF (Maks. 5MB)
                  </p>
                </div>

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={uploading || !paymentProof}
                >
                  {uploading ? 'Mengupload...' : 'Upload Bukti Pembayaran'}
                </Button>

                {/* Payment Info */}
                <div className="text-xs text-gray-500 space-y-1">
                  <p><strong>Rekening Tujuan:</strong></p>
                  <p>Bank: BNI</p>
                  <p>No. Rekening: 1234567890</p>
                  <p>a.n. LSP GATENSI NASIONAL</p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}