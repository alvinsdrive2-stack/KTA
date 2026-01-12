'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'

interface MapZoomIntroProps {
  regionName: string
  onComplete: () => void
}

export function MapZoomIntro({ regionName, onComplete }: MapZoomIntroProps) {
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const [contentOpacity, setContentOpacity] = useState(0)
  const [pinPulse, setPinPulse] = useState(false)
  const [logoOpacity, setLogoOpacity] = useState(0)
  const [logoScale, setLogoScale] = useState(0)

  useEffect(() => {
    // Start pin pulse after zoom begins
    const pulseTimer = setTimeout(() => setPinPulse(true), 800)

    // Zoom animation sequence
    const zoomSequence = async () => {
      // Phase 1: Zoom in (scale 1 → 3)
      await new Promise(resolve => {
        const duration = 2000
        const startTime = Date.now()

        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)

          // Easing function for smooth zoom
          const eased = 1 - Math.pow(1 - progress, 3)
          setScale(1 + (eased * 2))

          if (progress < 1) {
            requestAnimationFrame(animate)
          } else {
            resolve(undefined)
          }
        }

        requestAnimationFrame(animate)
      })

      // Phase 2: Hold briefly
      await new Promise(resolve => setTimeout(resolve, 500))

      // Phase 2.5: Show logo as transition
      setLogoOpacity(1)
      setLogoScale(1)

      // Phase 3: Fade out map after logo appears
      await new Promise(resolve => setTimeout(resolve, 800))
      setOpacity(0)
      setContentOpacity(1)

      // Phase 3.5: Fade out logo
      await new Promise(resolve => setTimeout(resolve, 400))
      setLogoOpacity(0)
      setLogoScale(1.5)

      // Phase 4: Call onComplete after logo fades out
      setTimeout(onComplete, 300)
    }

    zoomSequence()

    return () => {
      clearTimeout(pulseTimer)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 -z-10 flex items-center justify-center bg-white">
      {/* Indonesia Map Background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative"
          style={{
            transform: `scale(${scale})`,
            transition: 'transform 0.1s linear',
          }}
        >
          {/* Map Image */}
          <div
            className="w-screen h-screen bg-contain bg-center bg-no-repeat opacity-40"
            style={{
              backgroundImage: "url('/indonesia-map.png')",
            }}
          />

          {/* Location Pin */}
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
              pinPulse ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
            }`}
          >
            {/* Pulse rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-blue-500/20 rounded-full animate-ping" />
              <div className="absolute w-24 h-24 bg-blue-500/30 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
              <div className="absolute w-16 h-16 bg-blue-500/40 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
            </div>

            {/* Pin icon */}
            <div className="relative z-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-4 shadow-2xl">
              <MapPin className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Region Label */}
      <div
        className="relative z-20 text-center"
        style={{
          opacity: 1 - (scale - 1) * 0.5,
          transform: `scale(${Math.max(0, 2 - scale)})`,
        }}
      >
        <div className="bg-black/60 backdrop-blur-sm text-white px-8 py-4 rounded-2xl border border-white/20">
          <p className="text-sm uppercase tracking-wider text-blue-400 mb-2">Lokasi</p>
          <p className="text-2xl md:text-3xl font-bold">{regionName}</p>
        </div>
      </div>

      {/* Logo Transition */}
      <div
        className="fixed inset-0 flex items-center justify-center z-30"
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          transition: 'all 0.5s ease-out',
        }}
      >
        <div className="relative">
          {/* Logo with circular background */}
          <div className="bg-white rounded-full p-6 shadow-2xl flex items-center justify-center">
            <img
              src="/logoinv.png"
              alt="Gatensi Logo"
              className="w-28 h-28 object-contain"
              style={{
                filter: 'drop-shadow(0 0 12px rgba(30, 58, 138, 0.5))',
              }}
            />
          </div>
          {/* Animated rings around logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-44 h-44 border-4 border-blue-500/30 rounded-full animate-ping" />
          </div>
        </div>
      </div>

      {/* Content overlay (fades in) */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900"
        style={{ opacity: contentOpacity, transition: 'opacity 0.6s ease-out' }}
      >
        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-float-subtle" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-float-subtle" style={{ animationDelay: '1s' }} />
      </div>
    </div>
  )
}
