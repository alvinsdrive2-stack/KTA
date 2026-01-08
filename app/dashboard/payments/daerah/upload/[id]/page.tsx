'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Upload, AlertCircle, CheckCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { PulseLogo } from '@/components/ui/loading-spinner'

interface BulkPayment {
  id: string
  invoiceNumber: string
  totalJumlah: number
  totalNominal: number
  status: string
  createdAt: string
  payments: {
    id: string
    nominal: number
    ktaRequest: {
      id: string
      idIzin: string
      nama: string
      jenjang: string
    }
  }[]
}

export default function UploadProofPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [payment, setPayment] = useState<BulkPayment | null>(null)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPaymentDetails()
  }, [params.id])

  const fetchPaymentDetails = async () => {
    try {
      const response = await fetch(`/api/payments/bulk/${params.id}`)
      const data = await response.json()

      if (data.success) {
        setPayment(data.data)
      } else {
        setError('Invoice tidak ditemukan')
      }
    } catch (error) {
      setError('Gagal memuat data invoice')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.match(/image\/(jpeg|jpg|png)/) && !file.type.includes('pdf')) {
        setError('Hanya menerima file JPG, JPEG, PNG, atau PDF')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Ukuran file maksimal 5MB')
        return
      }

      setPaymentProof(file)
      setError(null)
    }
  }

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentProof) {
      setError('Harap pilih file bukti pembayaran')
      return
    }

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('paymentProof', paymentProof)
    formData.append('bulkPaymentId', params.id)

    try {
      const response = await fetch('/api/payments/upload-proof', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        router.push('/dashboard/payments/daerah?upload_success=true')
      } else {
        setError(result.error || 'Gagal mengupload bukti pembayaran')
      }
    } catch (error) {
      setError('Terjadi kesalahan saat mengupload bukti pembayaran')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data..." />
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/payments/daerah">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Invoice tidak ditemukan'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (payment.status !== 'PENDING') {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/payments/daerah">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invoice ini sudah tidak dalam status PENDING
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/payments/daerah">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Upload Bukti Pembayaran</h1>
          <p className="text-slate-500 text-sm">No: {payment.invoiceNumber}</p>
        </div>
      </div>

      <form onSubmit={handleSubmitUpload}>
        {/* Invoice Details */}
        <Card className="card-3d">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rincian Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-3">
              {payment.payments.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700">{idx + 1}.</span>
                      <div>
                        <p className="font-medium text-slate-900">{item.ktaRequest.nama}</p>
                        <p className="text-xs text-slate-500">
                          {item.ktaRequest.idIzin} • Jenjang {item.ktaRequest.jenjang}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      Rp {item.nominal.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <span className="font-semibold text-lg">Total Bayar</span>
              <span className="font-bold text-2xl text-blue-600">
                Rp {payment.totalNominal.toLocaleString('id-ID')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Upload Payment Proof */}
        <Card className="card-3d">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Bukti Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">File Bukti Pembayaran</label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Format: JPG, JPEG, PNG, atau PDF. Maksimal 5MB.
                </p>
              </div>
            </div>

            {paymentProof && (
              <Alert className="bg-blue-50 border-blue-200">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  File dipilih: {paymentProof.name}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/payments/daerah">
            <Button variant="outline" type="button" className="border-slate-300">
              Batal
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={!paymentProof || uploading}
            className="bg-blue-600 hover:bg-blue-700 px-8"
          >
            {uploading ? (
              <>
                <PulseLogo className="scale-50" />
                Mengupload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Bukti Pembayaran
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
