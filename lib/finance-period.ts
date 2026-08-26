export type PeriodFilter = '1month' | '3months' | '6months' | 'ytd'

export function getPeriodRange(filter: PeriodFilter): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  let start: Date

  switch (filter) {
    case '1month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      break
    case '3months':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      break
    case '6months':
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      break
    default:
      start = new Date(now.getFullYear(), 0, 1)
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
    return {
      start: new Date(`${startStr}T00:00:00`),
      end: new Date(`${endStr}T23:59:59.999`),
      period,
      isCustom: true,
    }
  }

  const range = getPeriodRange(period)
  return { ...range, period, isCustom: false }
}
