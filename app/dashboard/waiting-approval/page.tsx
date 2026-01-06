'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Search, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'

interface KTARequest {
  id: string
  idIzin: string
  nama: string
  nik: string
  jabatanKerja: string
  daerah: {
    namaDaerah: string
    kodeDaerah: string
  }
  requestedByUser: {
    name: string
    email: string
  }
  payments: {
    statusPembayaran: string
    jumlah: number
  }[]
}

export default function WaitingApprovalPage() {
  const [ktaRequests, setKtaRequests] = useState<KTARequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKTA, setSelectedKTA] = useState<KTARequest | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    fetchWaitingApprovals()
  }, [])

  const fetchWaitingApprovals = async () => {
    try {
      const response = await fetch('/api/pusat/approve?status=READY_FOR_PUSAT')
      const data = await response.json()
      setKtaRequests(data.success ? data.data.ktaRequests : [])
    } catch (error) {
      console.error('Error fetching waiting approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRequests = ktaRequests.filter(request =>
    request.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.idIzin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.nik.includes(searchTerm) ||
    request.daerah.namaDaerah.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleApproval = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedKTA) return

    setApproving(true)
    try {
      const response = await fetch('/api/pusat/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ktaRequestId: selectedKTA.id,
          status,
          catatan: approvalNotes,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setShowApprovalModal(false)
        setSelectedKTA(null)
        setApprovalNotes('')
        fetchWaitingApprovals()
      }
    } catch (error) {
      console.error('Approval error:', error)
    } finally {
      setApproving(false)
    }
  }

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PAID: 'bg-blue-100 text-blue-800',
      VERIFIED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PulseLogo text="Memuat data..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Menunggu Persetujuan</h1>
        <p className="text-gray-600">
          Daftar permohonan KTA yang menunggu persetujuan dari Pusat
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Cari berdasarkan nama, ID Izin, NIK, atau daerah..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500 py-8">
                Tidak ada permohonan yang menunggu persetujuan
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{request.nama}</h3>
                      <Badge variant="outline">
                        {request.daerah.kodeDaerah}
                      </Badge>
                      {request.payments[0]?.statusPembayaran === 'VERIFIED' && (
                        <Badge className="bg-green-100 text-green-800">
                          Lunas
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">ID Izin:</span>
                        <p className="font-medium">{request.idIzin}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">NIK:</span>
                        <p className="font-medium">{request.nik}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Jabatan:</span>
                        <p className="font-medium">{request.jabatanKerja}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Daerah:</span>
                        <p className="font-medium">{request.daerah.namaDaerah}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Dibuat oleh:</span>
                        <p className="font-medium">{request.requestedByUser.name}</p>
                      </div>
                      {request.payments[0] && (
                        <div>
                          <span className="text-gray-500">Pembayaran:</span>
                          <Badge className={getPaymentStatusColor(request.payments[0].statusPembayaran)}>
                            {request.payments[0].statusPembayaran}
                          </Badge>
                          <span className="ml-2">
                            Rp {request.payments[0].jumlah.toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedKTA(request)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {request.payments[0]?.statusPembayaran === 'VERIFIED' && (
                      <Dialog open={showApprovalModal && selectedKTA?.id === request.id} onOpenChange={setShowApprovalModal}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => setSelectedKTA(request)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Setujui KTA</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {selectedKTA && (
                              <div className="bg-gray-50 p-4 rounded-lg">
                                <p><strong>Nama:</strong> {selectedKTA.nama}</p>
                                <p><strong>ID Izin:</strong> {selectedKTA.idIzin}</p>
                                <p><strong>Daerah:</strong> {selectedKTA.daerah.namaDaerah}</p>
                              </div>
                            )}
                            <div>
                              <Label htmlFor="notes">Catatan (opsional)</Label>
                              <Textarea
                                id="notes"
                                placeholder="Tambahkan catatan untuk persetujuan..."
                                value={approvalNotes}
                                onChange={(e) => setApprovalNotes(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApproval('APPROVED')}
                                disabled={approving}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {approving ? 'Memproses...' : 'Setujui'}
                              </Button>
                              <Button
                                onClick={() => handleApproval('REJECTED')}
                                disabled={approving}
                                variant="destructive"
                                className="flex-1"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                {approving ? 'Memproses...' : 'Tolak'}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}