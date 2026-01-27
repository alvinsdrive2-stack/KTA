'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Download, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'

interface ImportError {
  kodeDaerah: string
  namaDaerah?: string
  status: 'success' | 'error'
  message?: string
  data?: {
    lastSequenceAhli: number
    lastSequenceTeknisi: number
    lastSequenceOperator: number
  }
}

interface ImportResult {
  success: boolean
  message: string
  summary: {
    total: number
    success: number
    error: number
  }
  results: ImportError[]
}

export default function ImportKTASequencePage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/kta-sequence/template')
      if (!response.ok) throw new Error('Failed to download template')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kta-sequence-template-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError('Gagal download template')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Pilih file terlebih dahulu')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/kta-sequence/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Nomor KTA Terakhir</h1>
        <p className="text-slate-500 text-sm mt-1">
          Update nomor KTA terakhir per daerah dari file Excel
        </p>
      </div>

      {/* Download Template */}
      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="text-base">1. Download Template</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Download template Excel yang berisi data daerah beserta nomor KTA terakhir saat ini.
          </p>
          <Button onClick={handleDownloadTemplate} variant="outline" className="border-slate-300">
            <Download className="h-4 w-4 mr-2" />
            Download Template Excel
          </Button>
        </CardContent>
      </Card>

      {/* Upload Excel */}
      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="text-base">2. Upload Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Setelah mengisi data di Excel, upload file yang sudah diisi untuk update nomor KTA terakhir.
          </p>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6">
            <div className="flex flex-col items-center">
              <FileSpreadsheet className="h-10 w-10 text-slate-400 mb-2" />
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-sm"
                disabled={uploading}
              />
              {file && (
                <p className="text-sm text-slate-600 mt-2">
                  File terpilih: <span className="font-medium">{file.name}</span>
                </p>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-slate-800 text-slate-100 hover:bg-slate-700 w-full sm:w-auto"
          >
            {uploading ? (
              <>
                <PulseLogo className="scale-50 mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Update
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="card-3d">
          <CardHeader>
            <CardTitle className="text-base">3. Hasil Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className={result.summary.error > 0 ? 'border-orange-200' : 'border-green-200'}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{result.message}</strong>
                <div className="mt-2 text-sm">
                  Total: {result.summary.total} |
                  <span className="text-green-600"> Sukses: {result.summary.success}</span> |
                  <span className="text-red-600"> Gagal: {result.summary.error}</span>
                </div>
              </AlertDescription>
            </Alert>

            {/* Detailed Results */}
            {result.results.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Kode Daerah</th>
                      <th className="text-left py-2 px-3 font-medium">Nama Daerah</th>
                      <th className="text-center py-2 px-3 font-medium">Ahli</th>
                      <th className="text-center py-2 px-3 font-medium">Teknisi</th>
                      <th className="text-center py-2 px-3 font-medium">Operator</th>
                      <th className="text-center py-2 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2 px-3">{item.kodeDaerah}</td>
                        <td className="py-2 px-3">{item.namaDaerah || '-'}</td>
                        {item.status === 'success' && item.data ? (
                          <>
                            <td className="py-2 px-3 text-center">{item.data.lastSequenceAhli}</td>
                            <td className="py-2 px-3 text-center">{item.data.lastSequenceTeknisi}</td>
                            <td className="py-2 px-3 text-center">{item.data.lastSequenceOperator}</td>
                            <td className="py-2 px-3 text-center">
                              <CheckCircle className="h-4 w-4 text-green-600 inline" />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-3 text-center" colSpan={3}>-</td>
                            <td className="py-2 px-3 text-center">
                              <XCircle className="h-4 w-4 text-red-600 inline" />
                              <span className="text-xs text-red-600 ml-1">{item.message}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
