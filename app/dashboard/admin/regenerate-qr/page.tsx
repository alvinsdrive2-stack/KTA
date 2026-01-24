'use client'

import { useState } from 'react'

export default function RegenerateQRPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const regenerateQRCodes = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/admin/regenerate-qr-codes', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate QR codes')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Regenerate QR Codes</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-gray-600 mb-4">
            This will regenerate QR codes for all approved KTAs using the fixed method.
          </p>
          <button
            onClick={regenerateQRCodes}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Regenerating...' : 'Regenerate All QR Codes'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            <h3 className="font-bold mb-2">Results:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Total KTAs: {result.data.total}</li>
              <li>Regenerated: {result.data.regenerated}</li>
              <li>Skipped: {result.data.skipped}</li>
              <li>Errors: {result.data.errors}</li>
            </ul>
            {result.data.errorDetails && result.data.errorDetails.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer font-semibold">Error Details</summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {JSON.stringify(result.data.errorDetails, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
