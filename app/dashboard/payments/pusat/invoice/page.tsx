'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, AlertCircle, CheckCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { Separator } from '@/components/ui/separator'
import { useInvoiceCreation } from '@/contexts/InvoiceCreationContext'

interface SelectedKTA {
  id: string
  idIzin: string
  nama: string
  nik: string
  jenjang: string
  hargaFinal: number
}

export default function PusatCreateInvoicePage() {
  const router = useRouter()
  const { setInvoiceKTAs, clearInvoiceKTAs } = useInvoiceCreation()
  const [selectedRequests, setSelectedRequests] = useState<SelectedKTA[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get selected requests from localStorage
    const stored = localStorage.getItem('selectedKTARequests')
    if (stored) {
      const parsed = JSON.parse(stored)
      setSelectedRequests(parsed)
      setInvoiceKTAs(parsed)
    } else {
      // If no selected requests, redirect back
      router.push('/dashboard/payments/pusat')
      setLoading(false)
      return
    }

    setLoading(false)
  }, [router])

  const calculateTotal = () => {
    return selectedRequests.reduce((sum, req) => sum + (req.hargaFinal || 0), 0)
  }

  const calculateSubtotal = () => {
    // Calculate without discount (base price)
    return selectedRequests.reduce((sum, req) => {
      // jenjang 1-6: 100k, jenjang 7-9: 300k
      const jenjangNum = parseInt(req.jenjang, 10)
      const basePrice = jenjangNum >= 7 ? 300000 : 100000
      return sum + basePrice
    }, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data..." />
      </div>
    )
  }

  if (selectedRequests.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/payments/pusat">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Tidak ada KTA yang dipilih. Silakan pilih KTA terlebih dahulu.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const subtotal = calculateSubtotal()
  const totalAmount = calculateTotal()

  // Generate invoice number
  const invoiceNo = `INV-${Date.now().toString().slice(-8)}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/payments/pusat">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Buat Invoice (Pusat)</h1>
          <p className="text-slate-500 text-sm">Review dan buat invoice untuk KTA yang dipilih</p>
        </div>
      </div>

      {/* Invoice Details Card */}
      <Card className="card-3d">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rincian Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* KTA List */}
          <div className="space-y-3">
            {selectedRequests.map((req, idx) => {
              const jenjangNum = parseInt(req.jenjang, 10)
              const basePrice = jenjangNum >= 7 ? 300000 : 100000

              return (
                <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700">{idx + 1}.</span>
                      <div>
                        <p className="font-medium text-slate-900">{req.nama}</p>
                        <p className="text-xs text-slate-500">
                          {req.idIzin} • Jenjang {req.jenjang}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      Rp {req.hargaFinal.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <Separator />

          {/* Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal ({selectedRequests.length} KTA)</span>
              <span className="font-medium">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>

            <Separator />

            <div className="flex justify-between">
              <span className="font-semibold text-lg">Total Bayar</span>
              <span className="font-bold text-2xl text-blue-600">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Spacer for floating button */}
      <div className="h-20" />
    </div>
  )
}
