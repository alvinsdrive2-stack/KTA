'use client'

import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { ShieldCheck, LogOut, Bell, Search, Menu, X, ChevronLeft, ChevronRight, HardHat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrentDate } from '@/components/ui/current-date'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import Image from 'next/image'
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context'

interface DashboardClientProps {
  children: React.ReactNode
  session: any
  isPusat: boolean
}

function DashboardContent({ children, session, isPusat }: DashboardClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebar()

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
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-blue-50"></div>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 hero-pattern"></div>
          </div>

          {/* Animated Gradient Orbs */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 sidebar-orb-1"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-600/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/4 sidebar-orb-2"></div>

          {/* Logo - LSP Gatensi Style with Indonesia Map */}
          <div className="relative h-24 flex items-center justify-between px-6 border-b border-slate-200/50 overflow-hidden">
            {/* Background Image - Indonesia Map */}
            <div className="absolute inset-0">
              <Image
                src="/indonesia-map.png"
                alt="Indonesia Map"
                fill
                className="object-cover opacity-40"
                priority
              />
            </div>

            {/* Primary Color Overlay - 50% opacity */}
            <div className="absolute inset-0" style={{
              backgroundColor: 'rgba(30, 58, 138, 0.9)'
            }}></div>

            {/* Content */}
            <div className="relative flex items-center gap-3 z-10">
              <div className="relative w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="KTA Logo"
                  fill
                  className="object-contain p-2"
                  priority
                />
              </div>
              <div className="text-white">
                <span className="text-lg font-bold tracking-tight">KTA System</span>
                <p className="text-[10px] text-blue-100 font-medium tracking-wide uppercase">LSP Gatensi</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-white hover:bg-white/10 relative z-10"
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
                  {isPusat ? 'Dashboard Pusat' : 'Dashboard Daerah'}
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
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md" style={{
                  background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)'
                }}>
                  {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
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
    <SidebarProvider>
      <DashboardContent {...props} />
    </SidebarProvider>
  )
}