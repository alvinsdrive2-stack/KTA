'use client'

import { useState } from 'react'

interface SIKIResponse {
  status: string
  nik: string
  id_izin: string
  jenjang: number
  all_jenjang: number[]
  personal: {
    nama: string
    nik: string
    tempat_lahir?: string
    tanggal_lahir?: string
    email?: string
  } | null
  klasifikasi: Array<{
    jenjang: string
    subklasifikasi: string
    kualifikasi: string
  }>
}

interface ResultWithTiming {
  data: SIKIResponse | null
  error: string | null
  timing: number // in ms
}

export default function SIKITestPage() {
  const [nik, setNik] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ResultWithTiming[]>([])
  const [totalTime, setTotalTime] = useState(0)

  const handleSearch = async () => {
    // Parse NIKs - split by comma or space, filter empty
    const niks = nik
      .split(/[,\s]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0)

    if (niks.length === 0) {
      return
    }

    setLoading(true)
    setResults([])
    setTotalTime(0)

    const startTime = performance.now()

    try {
      // Use bulk API endpoint
      const res = await fetch('/api/siki/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ niks }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan')
      }

      // Map bulk response to ResultWithTiming format
      const newResults: ResultWithTiming[] = data.results.map((r: any) => ({
        data: r.status === 'success' ? r : null,
        error: r.error || null,
        timing: r.timing || 0,
      }))

      const elapsed = performance.now() - startTime
      setResults(newResults)
      setTotalTime(elapsed)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      // Show error for all NIKs
      const newResults: ResultWithTiming[] = niks.map(n => ({
        data: null,
        error: errorMsg,
        timing: 0,
      }))
      setResults(newResults)
    } finally {
      setLoading(false)
    }
  }

  const foundCount = results.filter(r => r.data && !r.error).length
  const avgTime = results.length > 0 ? totalTime / results.length : 0

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-2">Test SIKI Lookup (Bulk)</h1>
          <p className="text-gray-600 mb-6">
            Cari data SIKI berdasarkan NIK - Support multiple NIKs pisahkan dengan koma atau spasi
          </p>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="Masukkan NIK(s) pisahkan dengan koma atau spasi..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Mencari...' : 'Cari'}
            </button>
          </div>

          {/* Benchmark Summary */}
          {results.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Benchmark Results</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total NIK:</span>
                  <div className="font-bold text-lg">{results.length}</div>
                </div>
                <div>
                  <span className="text-gray-600">Ditemukan:</span>
                  <div className="font-bold text-lg text-green-600">{foundCount}</div>
                </div>
                <div>
                  <span className="text-gray-600">Total Time:</span>
                  <div className="font-bold text-lg">{totalTime.toFixed(0)}ms</div>
                </div>
                <div>
                  <span className="text-gray-600">Avg Time:</span>
                  <div className="font-bold text-lg">{avgTime.toFixed(0)}ms</div>
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          {results.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">NIK</th>
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-center">Kualifikasi</th>
                    <th className="px-4 py-3 text-center">Time</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-3 font-mono text-xs">
                        {result.data?.nik || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {result.data?.personal?.nama || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {result.data?.jenjang !== undefined ? (
                          <span className="font-bold text-blue-600">
                            {result.data.jenjang}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono text-xs ${result.timing > 1000 ? 'text-orange-600' : 'text-gray-600'}`}>
                          {result.timing.toFixed(0)}ms
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {result.error ? (
                          <span className="text-red-600">{result.error}</span>
                        ) : (
                          <span className="text-green-600">Found</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
