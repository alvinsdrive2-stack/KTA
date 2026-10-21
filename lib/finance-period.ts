import { endOfWibDay, startOfWibDay, startOfWibMonth, startOfWibYear } from '@/lib/utils'

export type PeriodFilter = '1month' | '3months' | '6months' | 'ytd'

// Semua batas periode dipatok WIB. Dulu pakai konstruktor `new Date(y,m,d)`
// yang ngikutin zona mesin — di server UTC batas bulan mulai jam 07:00 WIB,
// jadi transaksi pagi tanggal 1 masuk bulan sebelumnya.
export function getPeriodRange(filter: PeriodFilter): { start: Date; end: Date } {
  const now = new Date()

  // Akhir = akhir hari terakhir bulan berjalan WIB.
  const end = new Date(startOfWibMonth(now, 1).getTime() - 1)

  let start: Date
  switch (filter) {
    case '1month':
      start = startOfWibMonth(now, -1)
      break
    case '3months':
      start = startOfWibMonth(now, -3)
      break
    case '6months':
      start = startOfWibMonth(now, -6)
      break
    default:
      start = startOfWibYear(now)
  }

  return { start, end }
}

// Resolusi rentang: prioritas start/end dari query params, fallback ke preset period.
export function resolveRange(searchParams: URLSearchParams): {
  start: Date
  end: Date
  period: PeriodFilter
  isCustom: boolean
} {
  const period = (searchParams.get('period') || 'ytd') as PeriodFilter
  const startStr = searchParams.get('start')
  const endStr = searchParams.get('end')

  if (startStr && endStr) {
    // `YYYY-MM-DD` dari input tanggal = tanggal kalender WIB, bukan zona mesin.
    return {
      start: startOfWibDay(startStr),
      end: endOfWibDay(endStr),
      period,
      isCustom: true,
    }
  }

  const range = getPeriodRange(period)
  return { ...range, period, isCustom: false }
}
