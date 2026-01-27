'use client'

import { useEffect, useState, useMemo } from 'react'

interface SIKIIndexItem {
  nik: string
  id_izin: string
  id_lsp: string
  created_at: string
  updated_at: string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface MetaData {
  cached: boolean
  lastFetch: number
  cacheExpiry: number
}

type SortColumn = 'nik' | 'id_izin' | 'id_lsp' | 'created_at' | 'updated_at'
type SortDirection = 'asc' | 'desc'

export default function SIKIIndexPage() {
  const [rawData, setRawData] = useState<SIKIIndexItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  })
  const [meta, setMeta] = useState<MetaData | null>(null)

  const fetchData = async (pageNum: number, searchQuery: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '100',
      })
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      const res = await fetch(`/api/siki/index?${params.toString()}`)
      const json = await res.json()

      setRawData(json.data || [])
      setPagination(json.pagination)
      setMeta(json.meta)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(page, search)
  }, [page])

  // Sort and paginate data
  const sortedAndPaginatedData = useMemo(() => {
    const sorted = [...rawData].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      let comparison = 0
      if (aVal < bVal) comparison = -1
      if (aVal > bVal) comparison = 1

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [rawData, sortColumn, sortDirection])

  const handleSearch = () => {
    setPage(1)
    fetchData(1, search)
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to desc for dates, asc for others
      setSortColumn(column)
      setSortDirection(column === 'created_at' || column === 'updated_at' ? 'desc' : 'asc')
    }
  }

  const formatCacheTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('id-ID')
  }

  const getCacheStatus = () => {
    if (!meta) return 'Loading...'

    const now = Date.now()
    const remaining = Math.max(0, meta.cacheExpiry - now)

    if (remaining === 0) return 'Cache expired'
    if (remaining < 60000) return `${Math.ceil(remaining / 1000)}s left`
    return `${Math.ceil(remaining / 60000)}m left`
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">SIKI Index Data</h1>
              <p className="text-gray-600 text-sm mt-1">
                Total Records: <span className="font-semibold">{pagination.total.toLocaleString()}</span>
              </p>
            </div>
            {meta && (
              <div className="text-right text-sm">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${meta.cached ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {meta.cached ? 'Cached' : 'Fresh'}
                  </span>
                  <span className="text-gray-600">{getCacheStatus()}</span>
                </div>
                {meta.lastFetch > 0 && (
                  <div className="text-gray-500 text-xs mt-1">
                    Last: {formatCacheTime(meta.lastFetch)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by NIK or ID Izin..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
            {search && (
              <button
                onClick={() => {
                  setSearch('')
                  setPage(1)
                  fetchData(1, '')
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading SIKI data...</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left">No</th>
                        <th
                          className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200 select-none"
                          onClick={() => handleSort('nik')}
                        >
                          NIK <SortIcon column="nik" />
                        </th>
                        <th
                          className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200 select-none"
                          onClick={() => handleSort('id_izin')}
                        >
                          ID Izin <SortIcon column="id_izin" />
                        </th>
                        <th
                          className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200 select-none"
                          onClick={() => handleSort('id_lsp')}
                        >
                          ID LSP <SortIcon column="id_lsp" />
                        </th>
                        <th
                          className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200 select-none"
                          onClick={() => handleSort('created_at')}
                        >
                          Created <SortIcon column="created_at" />
                        </th>
                        <th
                          className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200 select-none"
                          onClick={() => handleSort('updated_at')}
                        >
                          Updated <SortIcon column="updated_at" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAndPaginatedData.map((item, i) => (
                        <tr key={item.id_izin} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">
                            {(pagination.page - 1) * pagination.limit + i + 1}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {item.nik}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {item.id_izin}
                          </td>
                          <td className="px-4 py-3">{item.id_lsp}</td>
                          <td className="px-4 py-3 text-xs">
                            {new Date(item.created_at).toLocaleDateString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {new Date(item.updated_at).toLocaleDateString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={!pagination.hasPrev}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!pagination.hasNext}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
