'use client'

import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { ShieldCheck, LogOut, Bell, Search, Menu, X, ChevronLeft, ChevronRight, HardHat, ArrowRight, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrentDate } from '@/components/ui/current-date'
import { signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context'
import { PaymentSelectionProvider, usePaymentSelection } from '@/contexts/PaymentSelectionContext'
import { InvoiceCreationProvider, useInvoiceCreation } from '@/contexts/InvoiceCreationContext'
import { Card } from '@/components/ui/card'
import { CardContent } from '@/components/ui/card'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/components/ui/use-toast'
import { getDaerahLogoUrl } from '@/lib/daerah-logo'
import { ErrorBoundary } from '@/components/debug/error-boundary'
import { useRenderCount } from '@/hooks/useRenderCount'

interface DashboardClientProps {
  children: React.ReactNode
  isPusat: boolean
}

// Floating Payment Bar Component
function PaymentFloatingBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { selectedCount, totalAmount, selectedRequests, clearSelection } = usePaymentSelection()
  const { sidebarCollapsed } = useSidebar()
  useRenderCount('PaymentFloatingBar')

  // Only show on payments/daerah page
  const shouldShow = pathname?.includes('/payments/daerah') && selectedCount > 0 && !pathname?.includes('/invoice')

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

    router.push('/dashboard/payments/daerah/invoice')
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
  useRenderCount('InvoiceCreationBar')

  const shouldShow = pathname?.includes('/payments/daerah/invoice') && totalCount > 0

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
        window.location.href = '/dashboard/payments/daerah'
      }
    } catch (error) {
      console.error('Create invoice error:', error)
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
  const [showRejection, setShowRejection] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const { toast } = useToast()
  useRenderCount('VerificationFloatingBar')

  // Only show on /dashboard/payments/[id] pages for PUSAT/ADMIN
  const paymentId = pathname?.match(/\/dashboard\/payments\/([^/]+)/)?.[1]
  const shouldShow = paymentId && session?.user?.role && ['PUSAT', 'ADMIN'].includes(session.user.role)

  useEffect(() => {
    if (shouldShow && paymentId) {
      fetchPaymentDetail()
    }
  }, [shouldShow, paymentId])

  const fetchPaymentDetail = async () => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`)
      const data = await response.json()
      if (data.success && data.data.status === 'PAID') {
        setPayment(data.data)
      } else {
        setPayment(null)
      }
    } catch (error) {
      console.error('Error fetching payment:', error)
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
          description: approved ? 'Pembayaran berhasil diverifikasi' : 'Pembayaran telah ditolak'
        })
        setTimeout(() => window.location.reload(), 1000)
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

  return (
    <>
      <div className={`
        fixed bottom-0 left-0 right-0 z-50 transition-all duration-300
        ${sidebarCollapsed ? 'lg:left-0' : 'lg:left-64'}
      `}>
        <Card className="rounded-none shadow-2xl animate-slide-up">
          <CardContent className="py-4">
            <div className="flex items-center justify-between px-6 lg:px-8">
              <div>
                <p className="text-sm text-slate-600">Verifikasi Pembayaran</p>
                <p className="text-lg font-semibold text-slate-900">{payment.invoiceNumber}</p>
              </div>

              {!showRejection ? (
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
    </>
  )
}

function DashboardContent({ children, isPusat }: DashboardClientProps) {
  const { session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebar()
  const [daerahLogoError, setDaerahLogoError] = useState(false)
  useRenderCount('DashboardContent')

  // Extract daerahId to avoid infinite re-renders
  const daerahId = session?.user?.daerah?.id

  // Reset logo error when daerah changes
  useEffect(() => {
    setDaerahLogoError(false)
  }, [daerahId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50/10">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - LSP Gatensi Theme */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 overflow-hidden transition-all duration-300 ease-in-out lg:translate-x-0 animate-fade-in
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarCollapsed ? 'lg:-translate-x-full lg:w-0 lg:opacity-0' : 'lg:w-64 lg:opacity-100'}
          w-64
        `}
      >
        <div className="flex h-full flex-col shadow-2xl border-r border-slate-200/50 relative sidebar-shimmer">
          {/* Indonesia Map Background - White */}
          <div className="absolute inset-0 pointer-events-none">
            <Image
              src="/indonesia-map-white.png"
              alt="Indonesia Map"
              fill
              className="object-cover opacity-20"
              priority
            />
          </div>

          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-blue-50"></div>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 hero-pattern"></div>
          </div>

          {/* Animated Gradient Orbs */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 sidebar-orb-1"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-600/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/4 sidebar-orb-2"></div>

          {/* Logo - Primary Blue Header with Indonesia Map */}
          <div className="relative h-24 flex items-center justify-center bg-gradient-to-br from-blue-700 to-blue-100 shadow-md z-10 overflow-hidden">
            {/* Blue Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-400"></div>

            {/* Indonesia Map Background */}
            <div className="absolute inset-0 pointer-events-none mix-blend-overlay">
              <Image
                src="/indonesia-map-white.png"
                alt="Indonesia Map"
                fill
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
                    className="object-contain"
                    style={{
                      transform: 'translateY(2px)',
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
                  className="object-contain relative z-10"
                  style={{
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                  }}
                  priority
                />
              </div>
            </div>

            {/* Close Button - Mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden absolute right-4 text-white hover:bg-white/10 relative z-10"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <div className="relative flex-1 overflow-y-auto">
            <DashboardNav isPusat={isPusat} />
          </div>

          {/* Logout Button */}
          <div className="relative p-4 border-t border-slate-200/50 bg-white/50 backdrop-blur-sm">
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
        {/* Background Image - Indonesia Map with Primary Color */}
        <div className="fixed inset-0 pointer-events-none -z-10">
          <Image
            src="/indonesia-map.png"
            alt="Indonesia Map"
            fill
            className="object-cover"
            style={{
              filter: 'grayscale(100%) sepia(100%) saturate(500%) hue-rotate(200deg) brightness(0.7) opacity(0.3)',
              WebkitFilter: 'grayscale(100%) sepia(100%) saturate(500%) hue-rotate(200deg) brightness(0.7) opacity(0.3)'
            }}
            priority
          />
        </div>

        {/* Primary Color Overlay - 70% opacity */}
        <div className="fixed inset-0 pointer-events-none -z-10" style={{
          backgroundColor: 'rgba(30, 58, 138, 0.05)'
        }}></div>

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
                {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {isPusat ? 'Sistem KTA Pusat' : 'Sistem KTA Daerah'}
                </h1>
                <p className="text-sm text-slate-500">Selamat datang kembali, {session?.user?.name?.split(' ')[0] || 'User'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Date */}
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg border border-blue-200 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <CurrentDate />
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {session?.user?.name || 'Loading...'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {session?.user?.role?.toLowerCase() || 'Loading...'}
                    {session?.user?.daerah?.namaDaerah && ` • ${session.user.daerah.namaDaerah}`}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-white relative">
                  {session?.user?.daerah?.namaDaerah && !daerahLogoError ? (
                    <Image
                      src={getDaerahLogoUrl(session.user.daerah.namaDaerah)}
                      alt={session.user.daerah.namaDaerah}
                      fill
                      className="object-contain p-1"
                      onError={() => setDaerahLogoError(true)}
                      unoptimized
                    />
                  ) : (
                    <Image
                      src="/logo2inv.png"
                      alt="Logo"
                      fill
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
      <PaymentSelectionProvider>
        <InvoiceCreationProvider>
          <SidebarProvider>
            <DashboardContent {...props} />
            <PaymentFloatingBar />
            <InvoiceCreationBar />
            <VerificationFloatingBar />
          </SidebarProvider>
        </InvoiceCreationProvider>
      </PaymentSelectionProvider>
    </ErrorBoundary>
  )
}