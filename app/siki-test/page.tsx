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

export default function SIKITestPage() {
  const [nik, setNik] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SIKIResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!nik || nik.length < 5) {
      setError('Masukkan NIK yang valid')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/siki/${nik}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-2">Test SIKI Lookup</h1>
          <p className="text-gray-600 mb-6">
            Cari data SIKI berdasarkan NIK - Page ini tidak butuh login
          </p>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="Masukkan NIK..."
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

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h2 className="font-semibold text-green-800 mb-2">Data Ditemukan!</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Nama:</span>{' '}
                    <span className="font-medium">{result.personal?.nama || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">NIK:</span>{' '}
                    <span className="font-medium">{result.nik}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">ID Izin:</span>{' '}
                    <span className="font-medium">{result.id_izin}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Jenjang Tertinggi:</span>{' '}
                    <span className="font-bold text-blue-600 text-lg">{result.jenjang}</span>
                  </div>
                </div>
              </div>

              {result.klasifikasi.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Klasifikasi Kualifikasi:</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left">Jenjang</th>
                          <th className="px-4 py-2 text-left">Subklasifikasi</th>
                          <th className="px-4 py-2 text-left">Kualifikasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.klasifikasi.map((k, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-4 py-2 font-medium">{k.jenjang}</td>
                            <td className="px-4 py-2">{k.subklasifikasi}</td>
                            <td className="px-4 py-2">{k.kualifikasi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.personal?.tempat_lahir && (
                <div className="p-4 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <span className="text-gray-600">TTL:</span>{' '}
                    <span>
                      {result.personal.tempat_lahir}, {result.personal.tanggal_lahir}
                    </span>
                  </div>
                  {result.personal.email && (
                    <div>
                      <span className="text-gray-600">Email:</span> {result.personal.email}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-gray-500">
              <strong>Test NIKs dari data:</strong>
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {['3278021606940009', '1471052001910022', '6171051806930002'].map((testNik) => (
                <button
                  key={testNik}
                  onClick={() => setNik(testNik)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {testNik}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
