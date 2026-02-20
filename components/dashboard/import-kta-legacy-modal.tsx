'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useSession } from '@/hooks/useSession'
import * as XLSX from 'xlsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DialogDescription } from '@radix-ui/react-dialog'

interface ImportedRow {
  no: number
  nama: string
  nik: string
  idIzin?: string
  nomorKTA?: string
  jenjang: string
  jabatanKerja: string
  subklasifikasi: string
  noTelp: string
  email: string
  alamat: string
  tanggalDaftar: string
  daerahKode?: string
  daerahId?: string
}

interface ImportKtaLegacyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface Daerah {
  id: string
  namaDaerah: string
  kodeDaerah: string
}

export function ImportKtaLegacyModal({ open, onOpenChange, onSuccess }: ImportKtaLegacyModalProps) {
  const { session } = useSession()
  const { toast } = useToast()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'preview' | 'confirming'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [parseError, setParseError] = useState<{
    error: string
    details?: string
    foundColumns?: string[]
    expectedColumns?: string[]
    suggestion?: string
    normalizedHeaders?: Record<string, string>
  } | null>(null)
  const [previewData, setPreviewData] = useState<{
    preview: ImportedRow[]
    errors: Array<{ row: number; error: string; data?: any }>
    duplicates: Array<{
      nik: string
      nama: string
      nomorKTA?: string
      duplicateType?: string
      existingRecord: { nik: string; id: string; nama: string; nomorKTA?: string | null }
    }>
    totalRows: number
    validRows: number
    errorRows: number
    duplicateRows: number
  } | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [daerahList, setDaerahList] = useState<Daerah[]>([])

  const fetchDaerah = async () => {
    try {
      const response = await fetch('/api/daerah')
      const data = await response.json()
      if (data.success) {
        setDaerahList(data.data)
      }
    } catch (error) {
      console.error('Error fetching daerah:', error)
    }
  }

  useEffect(() => {
    if (open) {
      fetchDaerah()
    }
  }, [open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const fileName = selectedFile.name.toLowerCase()
    const isValid = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')

    if (!isValid) {
      toast({
        variant: 'destructive',
        title: 'File tidak valid',
        description: 'Silakan upload file Excel (.xlsx, .xls) atau CSV (.csv)',
      })
      return
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File terlalu besar',
        description: 'Ukuran file maksimal 50MB',
      })
      return
    }

    setFile(selectedFile)
  }

  const handleUploadAndParse = async () => {
    if (!file) return

    setLoading(true)
    setParseError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/kta/import-legacy', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setParseError({
          error: data.error || 'Gagal memparse file',
          details: data.details,
          foundColumns: data.foundColumns,
          expectedColumns: data.expectedColumns,
          suggestion: data.suggestion,
          normalizedHeaders: data.normalizedHeaders,
        })
        return
      }

      setPreviewData(data.data)
      setSelectedRows(new Set(data.data.preview.map(r => r.no)))
      setStep('preview')
    } catch (error) {
      setParseError({
        error: error instanceof Error ? error.message : 'Terjadi kesalahan',
        details: error instanceof Error ? error.stack : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    const selectedData = previewData?.preview.filter(r => selectedRows.has(r.no))
    if (!selectedData || selectedData.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Tidak ada data yang dipilih',
        description: 'Silakan pilih minimal satu data untuk diimpor',
      })
      return
    }

    // DEBUG: Log daerahList state
    console.log('[DEBUG] daerahList length:', daerahList.length)
    console.log('[DEBUG] daerahList sample:', daerahList.slice(0, 3))

    // Extract kodeDaerah from nomorKTA and match with daerah table
    const dataWithDaerahId = selectedData.map(row => {
      let daerahId: string | undefined

      if (row.nomorKTA) {
        // Extract kodeDaerah from nomorKTA (2 digits before the first dot)
        // Format: XX.YY.ZZZZZZ where XX is kodeDaerah
        const match = row.nomorKTA.match(/^(\d{2})\./)
        if (match) {
          const kodeDaerah = match[1]
          // Find matching daerah
          const matchedDaerah = daerahList.find(d => d.kodeDaerah === kodeDaerah)
          daerahId = matchedDaerah?.id
          console.log(`[DEBUG] Row ${row.no}: kodeDaerah=${kodeDaerah}, matched=${!!matchedDaerah}, daerahId=${daerahId}`)
        }
      }

      return {
        ...row,
        daerahId,
      }
    })

    // DEBUG: Log sample of data being sent
    console.log('[DEBUG] Sample data to send:', dataWithDaerahId.slice(0, 3).map(d => ({ no: d.no, nama: d.nama, daerahId: d.daerahId })))

    // Check if all rows have valid daerahId
    const rowsWithoutDaerah = dataWithDaerahId.filter(r => !r.daerahId)
    if (rowsWithoutDaerah.length > 0) {
      console.log('[DEBUG] Rows without daerah:', rowsWithoutDaerah.length)
      toast({
        variant: 'destructive',
        title: 'Daerah tidak ditemukan',
        description: `${rowsWithoutDaerah.length} data tidak memiliki kode daerah yang valid. Pastikan Nomor KTA diisi dengan format yang benar (XX.YY.ZZZZZZ)`,
      })
      return
    }

    setLoading(true)
    setStep('confirming')
    try {
      const response = await fetch('/api/kta/import-legacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: dataWithDaerahId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengimpor data')
      }

      toast({
        variant: 'success',
        title: 'Import Berhasil',
        description: `Berhasil mengimpor ${data.data.success} dari ${data.data.total} data legacy`,
      })

      onOpenChange(false)

      // Redirect to legacy page
      router.push('/dashboard/kta/legacy')

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal mengimpor data',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      })
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setStep('upload')
    setFile(null)
    setPreviewData(null)
    setSelectedRows(new Set())
    setParseError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetModal()
    onOpenChange(false)
  }

  const downloadTemplate = () => {
    const headers = ['Nama Lengkap', 'NIK', 'ID Izin (Opsional)', 'Nomor KTA (Opsional)', 'Jenjang', 'Jabatan Kerja', 'Subklasifikasi', 'NoTelp', 'Email', 'Alamat (Opsional)', 'Tanggal Daftar (YYYY-MM-DD)']
    const sampleData = [
      ['Ahmad Fauzi', '1234567890123456', '', '12.34.123456', '3', 'Pelaksana Lapangan', 'BL003', '081234567890', 'ahmad@example.com', 'Jl. Contoh No. 123', '2024-01-15'],
      ['Siti Rahayu', '2345678901234567', '', '12.34.123457', '5', 'Pelaksana Lapangan', 'BL003', '082345678901', 'siti@example.com', 'Jl. Contoh No. 456', '2024-01-16'],
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData])

    ws['!cols'] = [
      { wch: 25 }, // Nama
      { wch: 20 }, // NIK
      { wch: 20 }, // ID Izin
      { wch: 18 }, // Nomor KTA
      { wch: 8 },  // Jenjang
      { wch: 25 }, // Jabatan
      { wch: 18 }, // Subklasifikasi
      { wch: 15 }, // NoTelp
      { wch: 25 }, // Email
      { wch: 30 }, // Alamat
      { wch: 20 }, // Tanggal
    ]

    for (let i = 2; i <= sampleData.length + 1; i++) {
      const cellAddress = 'B' + i
      if (ws[cellAddress]) {
        ws[cellAddress].z = '@'
        ws[cellAddress].v = sampleData[i - 2][1].toString()
      }
    }

    for (let col = 0; col < headers.length; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E3F2FD" } },
          alignment: { horizontal: "center" }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Template Import Legacy')
    XLSX.writeFile(wb, 'template_import_kta_legacy.xlsx')
  }

  const toggleRowSelection = (rowNo: number) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(rowNo)) {
      newSelected.delete(rowNo)
    } else {
      newSelected.add(rowNo)
    }
    setSelectedRows(newSelected)
  }

  const toggleAllRows = () => {
    const validRows = previewData?.preview.map(r => r.no) || []
    if (selectedRows.size === validRows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(validRows))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-slate-900">
            {step === 'upload' && 'Import Data KTA Lama (Legacy)'}
            {step === 'preview' && 'Preview Data Import'}
            {step === 'confirming' && 'Memproses Import...'}
          </DialogTitle>
          {step === 'upload' && (
            <DialogDescription className="text-slate-500">
              Upload file Excel atau CSV yang berisi data KTA lama. Daerah akan diambil otomatis dari Nomor KTA (2 digit sebelum titik pertama).
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <h3 className="font-medium text-slate-900">Template Import Legacy</h3>
                  <p className="text-sm text-slate-500">Download template untuk format yang benar</p>
                </div>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  className="border-slate-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">Info Import Data Lama</p>
                    <ul className="text-sm text-amber-700 mt-1 space-y-1">
                      <li>• ID Izin opsional - boleh dikosongkan</li>
                      <li>• URL KTP dan Foto akan kosong (nanti bisa diupload)</li>
                      <li>• Status akan menjadi DRAFT</li>
                      <li>• Daerah diambil otomatis dari 2 digit pertama Nomor KTA (sebelum titik pertama)</li>
                      <li>• Format Nomor KTA: XX.YY.ZZZZZZ (XX = kode daerah)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-2">
                    <FileSpreadsheet className="h-12 w-12 text-emerald-600 mx-auto" />
                    <p className="font-medium text-slate-900">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    <Button
                      onClick={() => {
                        setFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      variant="outline"
                      className="border-slate-300"
                    >
                      Pilih File Lain
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 text-slate-400 mx-auto" />
                    <div>
                      <p className="text-slate-900 font-medium">Upload File Excel/CSV</p>
                      <p className="text-sm text-slate-500">Drag & drop atau klik untuk memilih file</p>
                    </div>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-800 text-slate-100 hover:bg-slate-700"
                    >
                      Pilih File
                    </Button>
                    <p className="text-xs text-slate-500">Format: .xlsx, .xls, .csv (Maks 50MB)</p>
                  </div>
                )}
              </div>

              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex gap-2">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-red-900">Error saat memparse file</p>
                      <p className="text-sm text-red-700 mt-1">{parseError.error}</p>
                      {parseError.suggestion && (
                        <p className="text-sm text-red-700 mt-2 italic">{parseError.suggestion}</p>
                      )}
                      {parseError.foundColumns && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-red-800">Kolom yang ditemukan:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parseError.foundColumns.map((col, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs border-red-300 text-red-700">
                                {col}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && previewData && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">Total Baris</p>
                  <p className="text-2xl font-bold text-blue-900">{previewData.totalRows}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-700">Valid</p>
                  <p className="text-2xl font-bold text-emerald-900">{previewData.validRows}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700">Error</p>
                  <p className="text-2xl font-bold text-red-900">{previewData.errorRows}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-700">Duplikat</p>
                  <p className="text-2xl font-bold text-amber-900">{previewData.duplicateRows}</p>
                </div>
              </div>

              {previewData.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-2">Error pada Baris:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {previewData.errors.map((err, idx) => (
                      <div key={idx} className="text-sm">
                        <p className="text-red-700 font-medium">Baris {err.row}: {err.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewData.duplicates.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900 mb-2">Data Duplikat:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {previewData.duplicates.map((dup, idx) => (
                      <p key={idx} className="text-sm text-amber-700">
                        {dup.nama} - <span className="font-medium">Duplikat {(dup as any).duplicateType || 'NIK'}</span>
                        {(dup as any).nomorKTA && ` (${(dup as any).nomorKTA})`}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === previewData.preview.length}
                    onChange={toggleAllRows}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {selectedRows.size} dari {previewData.preview.length} data dipilih
                  </span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700 w-10"></th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">No</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Nama</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">NIK</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">ID Izin</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Nomor KTA</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Daerah</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Jenjang</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Jabatan</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview.map((row) => (
                        <tr
                          key={row.no}
                          className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${selectedRows.has(row.no) ? 'bg-emerald-50' : ''}`}
                          onClick={() => toggleRowSelection(row.no)}
                        >
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(row.no)}
                              onChange={() => toggleRowSelection(row.no)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded"
                            />
                          </td>
                          <td className="px-2 py-2">{row.no}</td>
                          <td className="px-2 py-2 font-medium">{row.nama}</td>
                          <td className="px-2 py-2 font-mono">{row.nik}</td>
                          <td className="px-2 py-2 font-mono">{row.idIzin || '-'}</td>
                          <td className="px-2 py-2 font-mono">{row.nomorKTA || '-'}</td>
                          <td className="px-2 py-2">
                            {row.nomorKTA ? (
                              (() => {
                                const match = row.nomorKTA.match(/^(\d{2})\./)
                                const kodeDaerah = match ? match[1] : null
                                const matchedDaerah = kodeDaerah ? daerahList.find(d => d.kodeDaerah === kodeDaerah) : null
                                return matchedDaerah ? (
                                  <span className="text-green-600">{matchedDaerah.kodeDaerah} - {matchedDaerah.namaDaerah}</span>
                                ) : (
                                  <span className="text-red-600">{kodeDaerah || '?'}</span>
                                )
                              })()
                            ) : (
                              <span className="text-red-500">No KTA kosong</span>
                            )}
                          </td>
                          <td className="px-2 py-2">{row.jenjang}</td>
                          <td className="px-2 py-2">{row.jabatanKerja}</td>
                          <td className="px-2 py-2">{row.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'confirming' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-slate-400 animate-spin" />
              <p className="mt-4 text-slate-600">Memproses import data legacy...</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={step === 'upload' ? handleClose : () => setStep('upload')}
            className="border-slate-300"
            disabled={loading}
          >
            {step === 'upload' ? 'Batal' : 'Kembali'}
          </Button>

          {step === 'upload' && file && (
            <Button
              onClick={handleUploadAndParse}
              disabled={loading}
              className="bg-slate-800 text-slate-100 hover:bg-slate-700"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memparse...</> : 'Lanjut'}
            </Button>
          )}

          {step === 'preview' && (
            <Button
              onClick={handleConfirmImport}
              disabled={loading || selectedRows.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</> : `Import ${selectedRows.size} Data`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
