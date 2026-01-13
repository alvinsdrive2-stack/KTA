'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Shield, MapPin, Award, Calendar, Phone, Mail, IdCard, CheckCircle2 } from 'lucide-react'
import { MapZoomIntro } from '@/components/verification/map-zoom-intro'

interface KTAData {
  nomorKTA: string
  nama: string
  alamat: string
  noTelp: string
  email: string
  tanggalKadaluarsa: string
  daerah: string
  keahlian: string
}

interface VerifyKTAPageClientProps {
  ktaData: KTAData
}

export function VerifyKTAPageClient({ ktaData }: VerifyKTAPageClientProps) {
  const [showIntro, setShowIntro] = useState(true)
  const [showContent, setShowContent] = useState(false)

  const handleIntroComplete = () => {
    // Delay sedikit sebelum show content biar transisi smooth
    setTimeout(() => {
      setShowIntro(false)
      setShowContent(true)
    }, 150)
  }

  // Helper function untuk capitalize each word
  const capitalizeEachWord = (text: string) => {
    return text
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Format alamat dengan RT/RW
  const formatAlamatWithRW = (alamat: string) => {
    let formatted = capitalizeEachWord(alamat)
    formatted = formatted.replace(/\b\/?rt\b/gi, '/RT')
    formatted = formatted.replace(/\b\/?rw\b/gi, '/RW')
    formatted = formatted.replace(/\brt\b/gi, 'RT')
    formatted = formatted.replace(/\brw\b/gi, 'RW')
    return formatted
  }

  return (
    <>
      {showIntro && <MapZoomIntro regionName={ktaData.daerah} onComplete={handleIntroComplete} />}

      {showContent && (
        <div className="min-h-screen flex items-center justify-center p-4 py-12 relative animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
          {/* Background Map */}
          <div className="fixed inset-0 -z-10 bg-contain bg-center bg-no-repeat opacity-10"
               style={{
                 backgroundImage: "url('/indonesia-map.png')",
               }}
          />
          <div className="w-full max-w-2xl">
            {/* Main Card */}
            <Card className="overflow-hidden shadow-2xl shadow-slate-900/10 dark:shadow-black/50 border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-500 ease-out delay-100">
              {/* Header - Professional Blue */}
              <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 px-6 md:px-8 py-6">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                  {/* Logo */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-black/20">
                      <img
                        src="/logo.png"
                        alt="Gatensi Logo"
                        className="w-11 h-11 object-contain"
                      />
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 text-center sm:text-left">
                    <h1 className="text-xl md:text-2xl font-bold text-white mb-1 tracking-tight">
                      Kartu Tanda Anggota
                    </h1>
                    <p className="text-blue-200 text-sm font-medium">
                      Gatensi Karya Konstruksi
                    </p>
                  </div>
                </div>
              </div>

                {/* Card Content */}
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Section 1: Nomor KTA - Hero */}
                    <div className="bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-950/30 dark:to-slate-900/30 px-6 md:px-8 py-5 border-b border-blue-100 dark:border-blue-900/30">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">
                            Nomor KTA
                          </p>
                          <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                            {ktaData.nomorKTA}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
                          <img src="/logo.png" alt="Gatensi Logo" className="w-9 h-9 object-contain" />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Nama & Alamat */}
                    <div className="px-6 md:px-8 py-6 space-y-6">
                      {/* Nama */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                          Nama Anggota
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                            <IdCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-xl font-semibold text-slate-900 dark:text-white">
                            {capitalizeEachWord(ktaData.nama)}
                          </p>
                        </div>
                      </div>

                      {/* Alamat */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                          Alamat
                        </p>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {formatAlamatWithRW(ktaData.alamat)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Kontak */}
                    {(ktaData.noTelp || ktaData.email) && (
                      <div className="bg-slate-50/50 dark:bg-slate-900/30 px-6 md:px-8 py-5">
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
                          Informasi Kontak
                        </p>
                        <div className="grid md:grid-cols-2 gap-3">
                          {ktaData.noTelp && (
                            <a
                              href={`tel:${ktaData.noTelp}`}
                              className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
                            >
                              <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {ktaData.noTelp}
                              </span>
                            </a>
                          )}
                          {ktaData.email && (
                            <a
                              href={`mailto:${ktaData.email}`}
                              className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
                            >
                              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                {ktaData.email}
                              </span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 4: Detail Keanggotaan */}
                    <div className="px-6 md:px-8 py-5">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {/* Daerah */}
                        <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Daerah</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {ktaData.daerah}
                          </p>
                        </div>

                        {/* Keahlian */}
                        <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Keahlian</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {ktaData.keahlian}
                          </p>
                        </div>
                      </div>

                      {/* Masa Berlaku & Status - Combined */}
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/40 rounded-lg border border-emerald-200 dark:border-emerald-800 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                            </div>
                            <div>
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Status & Masa Berlaku</p>
                              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                                {ktaData.tanggalKadaluarsa}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-white dark:bg-emerald-900/40 px-4 py-2 rounded-lg">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                              Aktif
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* Footer - Verification Badge */}
                <div className="bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/30 dark:to-slate-900/30 px-6 md:px-8 py-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-center gap-2.5">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Terverifikasi & Valid
                    </p>
                  </div>
                </div>
              </Card>

              {/* Footer Info */}
              <div className="text-center mt-8 space-y-2">
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Scan QR Code untuk verifikasi keaslian dokumen
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  &copy; 2025 Gatensi Karya Konstruksi
                </p>
              </div>
            </div>
          </div>
      )}
    </>
  )
}
