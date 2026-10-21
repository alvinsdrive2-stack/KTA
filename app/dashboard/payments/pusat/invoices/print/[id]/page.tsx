'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Printer, Download, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Halaman print invoice: embed PDF lalu panggil print().
 *
 * Kenapa nggak buka PDF-nya langsung di tab baru: PDF di-serve route API dan
 * halaman kita nggak bisa manggil print() ke dokumen beda origin. Halaman ini
 * di origin yang sama, jadi iframe/object-nya bisa dicetak.
 *
 * Kenapa nggak pakai <iframe>: kalau browser nggak punya PDF viewer built-in,
 * iframe nyoba download PDF-nya ke disk dan `onLoad` nggak pernah fire —
 * spinner muter selamanya. <object> dengan fallback teks lebih jujur.
 */
const PRINT_TIMEOUT_MS = 4000

export default function InvoicePrintPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [siap, setSiap] = useState(false)
  const [status, setStatus] = useState<'memuat' | 'ok' | 'gagal'>('memuat')
  const [pesan, setPesan] = useState('')
  const [antrian, setAntrian] = useState<string[]>([])
  const objectRef = useRef<HTMLObjectElement>(null)
  const sudahPrint = useRef(false)

  const id = params.id
  const pdfUrl = `/api/payments/invoice/${id}/pdf`

  const index = antrian.indexOf(id)
  const prevId = index > 0 ? antrian[index - 1] : null
  const nextId = index >= 0 && index < antrian.length - 1 ? antrian[index + 1] : null

  // Urutan invoice sama dengan halaman /dashboard/payments/pusat/invoices
  // (createdAt desc, filter all+pusat). Diambil sekali, dipakai buat panah
  // prev/next biar bisa print satu-satu tanpa balik ke daftar.
  useEffect(() => {
    let batal = false
    fetch('/api/payments/bulk?all=true&pusat=true')
      .then((res) => res.json())
      .then((json) => {
        if (batal || !json?.success) return
        setAntrian((json.data as { id: string }[]).map((p) => p.id))
      })
      .catch(() => {
        // Panah aja yang nggak aktif; print tetap jalan.
      })
    return () => {
      batal = true
    }
  }, [])

  const pindah = (targetId: string | null) => {
    if (!targetId) return
    router.push(`/dashboard/payments/pusat/invoices/print/${targetId}`)
  }

  // Panah kiri/kanan buat pindah invoice. Dicek dulu biar nggak nabrak
  // input di toolbar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') pindah(nextId)
      if (e.key === 'ArrowLeft') pindah(prevId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevId, nextId])

  // Halaman ini tetap sama waktu pindah invoice (`router.push` ke route yang
  // sama) — state di atas nggak balik ke awal sendiri, jadi reset manual.
  useEffect(() => {
    setSiap(false)
    setStatus('memuat')
    setPesan('')
    sudahPrint.current = false
  }, [id])

  // Cek dulu: 401/403/404/500 ditampilkan sebagai pesan, bukan halaman kosong.
  useEffect(() => {
    let batal = false
    fetch(pdfUrl, { method: 'HEAD' })
      .then((res) => {
        if (batal) return
        if (res.ok) {
          setStatus('ok')
        } else {
          setStatus('gagal')
          setPesan(
            res.status === 401
              ? 'Sesi habis. Login ulang lalu coba lagi.'
              : res.status === 403
                ? 'Akun ini tidak punya akses ke invoice ini.'
                : res.status === 404
                  ? 'Invoice tidak ditemukan.'
                  : `Gagal membuat PDF (HTTP ${res.status}).`
          )
        }
      })
      .catch(() => {
        if (batal) return
        setStatus('gagal')
        setPesan('Gagal menghubungi server.')
      })
    return () => {
      batal = true
    }
  }, [pdfUrl])

  // Viewer yang nggak pernah lapor load juga nggak boleh bikin spinner abadi.
  useEffect(() => {
    if (status !== 'ok') return
    const timer = setTimeout(() => {
      if (!sudahPrint.current) {
        setSiap(false)
        setStatus('gagal')
        setPesan('PDF tidak bisa ditampilkan di browser ini. Pakai tombol Download lalu cetak dari PDF viewer.')
      }
    }, PRINT_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [status])

  const cetak = () => {
    const obj = objectRef.current
    try {
      const win = (obj?.contentWindow || obj?.contentDocument) as Window | null
      if (!win) throw new Error('no viewer')
      win.focus()
      win.print()
    } catch {
      setPesan('Browser memblokir cetak dari halaman ini. Pakai tombol Download lalu cetak dari PDF viewer.')
    }
  }

  useEffect(() => {
    if (!siap || sudahPrint.current) return
    sudahPrint.current = true
    // Kasih waktu viewer selesai render sebelum dialog print.
    const timer = setTimeout(cetak, 500)
    return () => clearTimeout(timer)
  }, [siap])

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <p className="text-sm text-slate-600">
          {siap
            ? 'Kalau dialog print tidak muncul, pakai tombol Cetak.'
            : 'Menyiapkan PDF...'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => pindah(prevId)}
            disabled={!prevId}
            title="Invoice sebelumnya (←)"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => pindah(nextId)}
            disabled={!nextId}
            title="Invoice berikutnya (→)"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
          {index >= 0 && (
            <span className="self-center text-xs text-slate-500 px-1">
              {index + 1}/{antrian.length}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Tutup
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href={pdfUrl} download>
              <Download className="h-4 w-4" />
              Download
            </a>
          </Button>
          <Button size="sm" className="gap-2" onClick={cetak} disabled={!siap}>
            <Printer className="h-4 w-4" />
            Cetak
          </Button>
        </div>
      </div>

      <div className="relative flex-1">
        {status === 'gagal' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-slate-700 max-w-md">{pesan}</p>
          </div>
        ) : (
          <>
            {!siap && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}
            {status === 'ok' && (
              <object
                key={id}
                ref={objectRef}
                data={pdfUrl}
                type="application/pdf"
                className="w-full h-[calc(100vh-57px)]"
                onLoad={() => setSiap(true)}
              >
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                  <p className="text-sm text-slate-700 max-w-md">
                    Browser ini tidak bisa menampilkan PDF langsung. Pakai tombol Download lalu cetak dari PDF viewer.
                  </p>
                </div>
              </object>
            )}
          </>
        )}
      </div>
    </div>
  )
}
