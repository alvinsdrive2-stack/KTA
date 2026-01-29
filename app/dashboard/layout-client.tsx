'use client'

import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { ShieldCheck, LogOut, Bell, Search, Menu, X, ChevronLeft, ChevronRight, HardHat, ArrowRight, FileText, CheckCircle, XCircle, Loader2, Download, Package, MenuIcon, PanelLeftClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrentDate } from '@/components/ui/current-date'
import { signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePageTitle } from '@/hooks/use-page-title'
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context'
import { PaymentSelectionProvider, usePaymentSelection } from '@/contexts/PaymentSelectionContext'
import { InvoiceCreationProvider, useInvoiceCreation } from '@/contexts/InvoiceCreationContext'
import { KTASelectionProvider, useKTASelection } from '@/contexts/KTASelectionContext'
import { Card } from '@/components/ui/card'
import { CardContent } from '@/components/ui/card'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/components/ui/use-toast'
import { getDaerahLogoUrl } from '@/lib/daerah-logo'
import { ErrorBoundary } from '@/components/debug/error-boundary'

interface DashboardClientProps {
  children: React.ReactNode
  isPusat: boolean
  isKeuangan: boolean
}

// Floating Payment Bar Component
function PaymentFloatingBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { selectedCount, totalAmount, selectedRequests, clearSelection } = usePaymentSelection()
  const { sidebarCollapsed } = useSidebar()

  // Only show on payments/daerah or payments/pusat page
  const shouldShow = (pathname?.includes('/payments/daerah') || pathname?.includes('/payments/pusat')) && selectedCount > 0 && !pathname?.includes('/invoice')

  const handleProceedToPayment = () => {
    // Store selected requests in localStorage for the invoice page
    const selectedData = selectedRequests.map(({ id, idIzin, nama, nik, jenjang, hargaFinal }) => ({
      id,
      idIzin,
      nama,
      nik,
      jenjang,
      hargaFinal
    }))
    localStorage.setItem('selectedKTARequests', JSON.stringify(selectedData))

    // Clear selection immediately
    clearSelection()

    // Navigate to the correct invoice page based on current pathname
    if (pathname?.includes('/payments/pusat')) {
      router.push('/dashboard/payments/pusat/invoice')
    } else {
      router.push('/dashboard/payments/daerah/invoice')
    }
  }

  if (!shouldShow) {
    return null
  }

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 z-50 transition-all duration-300
      ${sidebarCollapsed ? 'lg:left-0' : 'lg:left-64'}
    `}>
      <Card className="rounded-none shadow-2xl animate-slide-up">
        <CardContent className="py-4">
          <div className="flex items-center justify-between px-6 lg:px-8">
            <div>
              <p className="text-sm text-slate-600">{selectedCount} KTA dipilih</p>
              <p className="text-2xl font-bold text-slate-900">
                Total: Rp {totalAmount.toLocaleString('id-ID')}
              </p>
            </div>
            <Button
              onClick={handleProceedToPayment}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
            >
              Lanjut Pembayaran
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Invoice Creation Bar Component
function InvoiceCreationBar() {
  const pathname = usePathname()
  const { sidebarCollapsed } = useSidebar()
  const { totalCount, totalAmount, clearInvoiceKTAs } = useInvoiceCreation()
  const [creating, setCreating] = useState(false)

  // Show for both daerah and pusat invoice pages
  const shouldShow = (pathname?.includes('/payments/daerah/invoice') || pathname?.includes('/payments/pusat/invoice')) && totalCount > 0 && !pathname?.match(/\/invoice\/[^/]+$/)

  const handleCreateInvoice = async () => {
    setCreating(true)

    try {
      const stored = localStorage.getItem('selectedKTARequests')
      if (!stored) {
        return
      }

      const selectedRequests = JSON.parse(stored)

      const response = await fetch('/api/payments/create-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestIds: selectedRequests.map((req: any) => req.id)
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        localStorage.removeItem('selectedKTARequests')
        clearInvoiceKTAs()
        // Navigate to the correct payments page based on current pathname
        if (pathname?.includes('/payments/pusat')) {
          window.location.href = '/dashboard/payments/pusat'
        } else {
          window.location.href = '/dashboard/payments/daerah'
        }
      }
    } catch (error) {
      // Error handling silent for production
    } finally {
      setCreating(false)
    }
  }

  if (!shouldShow) {
    return null
  }

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 z-50 transition-all duration-300
      ${sidebarCollapsed ? 'lg:left-0' : 'lg:left-64'}
    `}>
      <Card className="rounded-none shadow-2xl animate-slide-up">
        <CardContent className="py-4">
          <div className="flex items-center justify-between px-6 lg:px-8">
            <div>
              <p className="text-sm text-slate-600">{totalCount} KTA akan dibuat invoice</p>
              <p className="text-2xl font-bold text-slate-900">
                Total: Rp {totalAmount.toLocaleString('id-ID')}
              </p>
            </div>
            <Button
              onClick={handleCreateInvoice}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
            >
              {creating ? (
                <>Membuat Invoice...</>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Buat Invoice
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Verification Floating Bar Component
function VerificationFloatingBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { session } = useSession()
  const { sidebarCollapsed } = useSidebar()
  const [payment, setPayment] = useState<any>(null)
  const [verifying, setVerifying] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [showRejection, setShowRejection] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const { toast } = useToast()

  // Only show on /dashboard/payments/[id] pages for PUSAT/ADMIN (NOT on /payments/pusat or /payments/daerah list pages)
  const paymentId = pathname?.match(/\/dashboard\/payments\/([^/]+)/)?.[1]
  const isListPage = pathname?.includes('/payments/pusat') || pathname?.includes('/payments/daerah')
  const shouldShow = paymentId && session?.user?.role && ['KEUANGAN', 'ADMIN'].includes(session.user.role) && !isListPage && !pathname?.includes('/invoice')

  useEffect(() => {
    if (shouldShow && paymentId) {
      fetchPaymentDetail()
    }
  }, [shouldShow, paymentId])

  const fetchPaymentDetail = async () => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`)
      const data = await response.json()

      if (data.success && (data.data.status === 'PENDING' || data.data.status === 'PAID' || data.data.status === 'VERIFIED')) {
        setPayment(data.data)
      } else {
        setPayment(null)
      }
    } catch (error) {
      // Silent error handling for production
    }
  }

  const handleDownloadAllKTA = async () => {
    if (!payment?.payments) return

    setDownloadingZip(true)
    try {
      const ktaIds = payment.payments.map((p: any) => p.ktaRequestId)

      const response = await fetch('/api/kta/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ktaIds })
      })

      if (response.ok) {
        // Download ZIP file
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KTA-${payment.invoiceNumber}.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          variant: 'success',
          title: 'Download Berhasil',
          description: `Berhasil mendownload ${payment.payments.length} KTA.`,
        })
      } else {
        const error = await response.json()
        toast({
          variant: 'destructive',
          title: 'Download Gagal',
          description: error.error || 'Gagal mendownload KTA.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Download Gagal',
        description: 'Terjadi kesalahan saat mendownload KTA.',
      })
    } finally {
      setDownloadingZip(false)
    }
  }

  const handleVerify = async (approved: boolean) => {
    if (!approved && !rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Alasan Penolakan Diperlukan',
        description: 'Harap isi alasan penolakan'
      })
      return
    }

    setVerifying(true)
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkPaymentId: payment.id,
          approved,
          reason: approved ? null : rejectionReason
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: approved ? 'Pembayaran Disetujui' : 'Pembayaran Ditolak',
          description: approved ? 'Pembayaran berhasil diverifikasi. KTA sedang dibuat...' : 'Pembayaran telah ditolak'
        })
        setShowRejection(false)
        setRejectionReason('')

        if (approved) {
          // PDFs are generated synchronously now, just wait a bit then fetch
          setTimeout(() => fetchPaymentDetail(), 500)
        } else {
          // For rejected, redirect back
          setTimeout(() => router.push('/dashboard/payments'), 1000)
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal Memverifikasi',
          description: result.error || 'Gagal memverifikasi pembayaran'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Terjadi Kesalahan',
        description: 'Terjadi kesalahan saat memverifikasi pembayaran'
      })
    } finally {
      setVerifying(false)
    }
  }

  if (!shouldShow || !payment) {
    return null
  }

  const isVerified = payment.status === 'VERIFIED'

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 z-50 transition-all duration-300
      ${sidebarCollapsed ? 'lg:left-0' : 'lg:left-64'}
    `}>
      <Card className="rounded-none shadow-2xl animate-slide-up">
        <CardContent className="py-4">
          <div className="flex items-center justify-between px-6 lg:px-8">
            <div>
              <p className="text-sm text-slate-600">
                {isVerified ? 'Pembayaran Terverifikasi' : 'Verifikasi Pembayaran'}
              </p>
              <p className="text-lg font-semibold text-slate-900">{payment.invoiceNumber}</p>
              {!isVerified && (
                <p className="text-xs text-slate-500">
                  {payment.totalJumlah} KTA • Rp {payment.totalNominal?.toLocaleString('id-ID')}
                </p>
              )}
            </div>

            {isVerified ? (
              <Button
                onClick={handleDownloadAllKTA}
                disabled={downloadingZip}
                className="bg-green-600 hover:bg-green-700 px-8 py-6 text-lg"
              >
                {downloadingZip ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Download Semua KTA ({payment.payments?.length || 0})
                  </>
                )}
              </Button>
            ) : !showRejection ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRejection(true)}
                  disabled={verifying}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Tolak
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleVerify(true)}
                  disabled={verifying}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Setujui
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Alasan penolakan..."
                  className="border border-slate-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
                <Button
                  onClick={() => handleVerify(false)}
                  disabled={verifying || !rejectionReason.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Konfirmasi Tolak
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowRejection(false)
                    setRejectionReason('')
                  }}
                  variant="outline"
                  disabled={verifying}
                >
                  Batal
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// KTA Bulk Download Floating Bar Component
function KTAFloatingBar() {
  const pathname = usePathname()
  const { sidebarCollapsed } = useSidebar()
  const { selectedCount, selectedKTAs, clearSelection } = useKTASelection()
  const [downloadingBulk, setDownloadingBulk] = useState(false)

  // Only show on /dashboard/kta page
  const shouldShow = pathname?.includes('/dashboard/kta') && !pathname?.includes('/dashboard/kta/') && selectedCount > 0

  const handleBulkDownload = async () => {
    if (selectedCount === 0) return

    setDownloadingBulk(true)

    try {
      const response = await fetch('/api/kta/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ktaIds: selectedKTAs.map(k => k.id) })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KTA-Bulk-${Date.now()}.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        clearSelection()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to download files')
      }
    } catch (error) {
      alert('Failed to download files')
    } finally {
      setDownloadingBulk(false)
    }
  }

  if (!shouldShow) {
    return null
  }

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 z-50 transition-all duration-300
      ${sidebarCollapsed ? 'lg:left-0' : 'lg:left-64'}
    `}>
      <Card className="rounded-none shadow-2xl animate-slide-up">
        <CardContent className="py-4">
          <div className="flex items-center justify-between px-6 lg:px-8">
            <div>
              <p className="text-sm text-slate-600">{selectedCount} KTA dipilih</p>
              <p className="text-2xl font-bold text-slate-900">
                Download sebagai ZIP
              </p>
            </div>
            <Button
              onClick={handleBulkDownload}
              disabled={downloadingBulk}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
            >
              {downloadingBulk ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Package className="h-5 w-5 mr-2" />
                  Download {selectedCount} KTA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardContent({ children, isPusat, isKeuangan }: DashboardClientProps) {
  const { session } = useSession()
  usePageTitle() // Auto-set page title based on active nav

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebar()
  const [daerahLogoError, setDaerahLogoError] = useState(false)

  // Extract daerahId to avoid infinite re-renders
  const daerahId = session?.user?.daerah?.id

  // Reset logo error when daerah changes
  useEffect(() => {
    setDaerahLogoError(false)
  }, [daerahId])

  // Close sidebar on mobile when pressing ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [sidebarOpen])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  return (
    <div className="min-h-screen bg-white/80">
      {/* Mobile overlay - closes sidebar when clicked outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Gatensi Theme */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 overflow-hidden transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarCollapsed ? 'lg:-translate-x-full lg:w-0 lg:opacity-0' : 'lg:w-64 lg:opacity-100'}
          w-64
        `}
      >
        <div className="flex h-full flex-col relative sidebar-shimmer bg-white/70">
          {/* Logo - Primary Blue Header with Indonesia Map */}
          <div className="relative h-20 flex items-center justify-center shadow-sm z-10 overflow-hidden">
            {/* Background with Indonesia Map */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-blue-600">
              <Image
                src="/indonesia-map_red-and-blue.png"
                alt="Indonesia Map"
                fill
                sizes="256px"
                className="object-cover opacity-50"
                priority
              />
            </div>
            {/* Logo with Floating Effect & Border from PNG */}
            <div className="relative flex items-center justify-center z-10">
              <div className="relative w-56 h-16 p-2">
                {/* Drop Shadow - Make Logo Pop */}
                <div className="absolute inset-0 filter drop-shadow-2xl">
                  <Image
                    src="/logo.png"
                    alt="Logo Shadow"
                    fill
                    sizes="224px"
                    className="object-contain"
                    style={{
                      transform: 'translateY(1.5px)',
                      filter: 'brightness(0) drop-shadow(0 8px 8px rgba(255,255,255,0.6)) drop-shadow(0 4px 8px rgba(255,255,255,0.4))'
                    }}
                    priority
                  />
                </div>

                {/* Main Logo */}
                <Image
                  src="/logo.png"
                  alt="KTA Logo"
                  fill
                  sizes="224px"
                  className="object-contain relative z-10"
                  style={{
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                  }}
                  priority
                />
              </div>
            </div>

          </div>


          {/* Navigation */}
          <div className="relative flex-1 overflow-y-auto border-r border-slate-200/50 pb-4 shadow-md">
            <DashboardNav isPusat={isPusat}  isKeuangan={isKeuangan}/>
          </div>

          {/* Logout Button */}
          <div className="relative p-4 border-t border-r border-slate-200/50 bg-white/50 backdrop-blur-sm shadow-xl">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-slate-300 text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-200 group shadow-sm"
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
            >
              <LogOut className="h-4 w-4 mr-2 group-hover:translate-x-1 transition-transform" />
              Keluar
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`
        transition-all duration-300 relative
        ${sidebarCollapsed ? 'lg:pl-0' : 'lg:pl-64'}
      `}>
        {/* Background Image - Indonesia Map */}
        <div className="fixed inset-0 pointer-events-none -z-10">
          <Image
            src="/indonesia-map_red-and-blue.png"
            alt="Indonesia Map"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="fixed inset-0 pointer-events-none -z-10" style={{ backgroundColor: 'rgba(300, 300, 300, 0.01)' }}></div> 
        {/* Header */}
        <header className="sticky top-0 z-30 h-20 bg-white/80 backdrop-blur-lg shadow-sm border-b border-slate-200/50 transition-all duration-300 animate-fade-in">
          <div className="flex h-full items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden lg:flex hover:bg-slate-100 text-slate-600"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Tampilkan Sidebar' : 'Sembunyikan Sidebar'}
              >
                {sidebarCollapsed ? <MenuIcon className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {isPusat ? 'Sistem KTA BPP' : isKeuangan ? 'Sistem KTA Keuangan' : 'Sistem KTA BPD'}
                </h1>
                <p className="text-sm text-slate-500">Selamat datang kembali, {isPusat ? 'BPP' : isKeuangan ? 'Finance' : '\BPD'} {session?.user?.name || 'User'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Date */}
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                <CurrentDate />
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {session?.user?.name || 'Loading...'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {session?.user?.role === 'PUSAT' ? 'BPP' : session?.user?.role === 'ADMIN' ? 'Admin' : session?.user?.role === 'KEUANGAN' ? 'Keuangan' : session?.user?.role === 'DAERAH' ? 'BPD' : session?.user?.role?.toLowerCase() || 'Loading...'}
                    {session?.user?.daerah?.namaDaerah && ` • ${session.user.daerah.namaDaerah}`}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-white relative">
                  {session?.user?.daerah?.namaDaerah && !daerahLogoError ? (
                    <Image
                      src={getDaerahLogoUrl(session.user.daerah.namaDaerah)}
                      alt={session.user.daerah.namaDaerah}
                      fill
                      sizes="40px"
                      className="object-contain p-1"
                      onError={() => setDaerahLogoError(true)}
                      unoptimized
                    />
                  ) : (
                    <Image
                      src="/logo.png"
                      alt="Logo"
                      fill
                      sizes="40px"
                      className="object-contain p-1"
                      unoptimized
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 lg:p-8 animate-slide-up">
          {children}
        </div>
      </main>
    </div>
  )
}

export function DashboardClient(props: DashboardClientProps) {
  return (
    <ErrorBoundary>
      <KTASelectionProvider>
        <PaymentSelectionProvider>
          <InvoiceCreationProvider>
            <SidebarProvider>
              <DashboardContent {...props} />
              <PaymentFloatingBar />
              <InvoiceCreationBar />
              <VerificationFloatingBar />
              <KTAFloatingBar />
            </SidebarProvider>
          </InvoiceCreationProvider>
        </PaymentSelectionProvider>
      </KTASelectionProvider>
    </ErrorBoundary>
  )
}