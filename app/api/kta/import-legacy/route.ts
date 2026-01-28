import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

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

// Helper to parse Excel/CSV date
function parseDateValue(value: any): Date {
  if (!value) return new Date()

  // If it's already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? new Date() : value
  }

  // If it's a number (Excel date format)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      return new Date(date.y, date.m - 1, date.d)
    }
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

// Helper to normalize column name
function normalizeColumnName(name: string): string {
  if (!name) return ''
  return name.toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/_+/g, '_')
    .trim()
}

// Helper to find column mapping
function mapColumns(headers: string[], rawData?: any[]): { mapping: Record<string, string>; normalized: Record<string, string> } {
  const mapping: Record<string, string> = {}
  const normalized: Record<string, string> = {}

  // Normalize all headers for debugging
  headers.forEach(h => {
    normalized[h] = normalizeColumnName(h)
  })

  // Define possible column name variations (in order of priority)
  const columnVariations: Record<string, string[]> = {
    nama: ['NAMA_LENGKAP', 'NAMALENGKAP', 'NAMA', 'FULLNAME', 'FULL_NAME', 'NAMALAHIR', 'NAMA_LAHIR'],
    nik: ['NIK', 'NO_NIK', 'NOMOR_NIK', 'NOIDENTITAS', 'NO_ID'],
    idIzin: ['ID_IZIN', 'IDIZIN', 'REGISTRATION_NUMBER'],
    nomorKTA: ['NOMOR_KTA', 'NOKTA', 'NO_KTA', 'KTA', 'NO_ANGGOTA', 'NOMOR_ANGGOTA', 'NO_KTA_ASLI', 'NOMOR_KTA_ASLI', 'NOMORKTA', 'NOMOR KTA', 'NO KTA','Nomor KTA (Opsional)'],
    jenjang: ['JENJANG', 'LEVEL', 'TINGKAT', 'GRADE'],
    jabatanKerja: ['JABATAN_KERJA', 'JABATANKERJA', 'JABATAN', 'POSITION', 'JOB_TITLE'],
    subklasifikasi: ['SUBKLASIFIKASI', 'SUB_KLASIFIKASI', 'SUBCLASS', 'SUB_CLASSIFICATION', 'KLASIFIKASI'],
    noTelp: ['NO_TELP', 'NOTELEPON', 'NOTELP', 'TELP', 'TELEPON', 'TELEPHONE', 'PHONE', 'HP', 'NO_HP', 'WHATSAPP', 'WA'],
    email: ['EMAIL', 'E_MAIL', 'E-MAIL', 'EMAIL_ADDRESS'],
    alamat: ['ALAMAT', 'ADDRESS'],
    tanggalDaftar: ['TANGGAL_DAFTAR', 'TANGGALDAFTAR', 'TGL_DAFTAR', 'TGLDAFTAR', 'TANGGAL', 'DATE', 'REGISTRATION_DATE'],
    daerahKode: ['DAERAH', 'KODE_DAERAH', 'KODEDAERAH', 'WILAYAH', 'REGION', 'REGION_CODE', 'PROVINSI', 'PROVINCE'],
  }

  // Find matching columns
  Object.entries(columnVariations).forEach(([field, variations]) => {
    for (const variation of variations) {
      const foundIndex = headers.findIndex(h => normalizeColumnName(h) === variation)
      if (foundIndex !== -1) {
        mapping[field] = headers[foundIndex]
        break
      }
    }
  })

  // Fallback for nomorKTA: try to detect by content pattern (XX.YY.ZZZZZZ format)
  // if no column was found by name
  if (!mapping.nomorKTA && rawData && rawData.length > 0) {
    for (const header of headers) {
      // Check if this column contains values matching KTA number pattern
      const sampleValue = rawData[0]?.[header]
      if (sampleValue) {
        const trimmed = sampleValue.toString().trim()
        // Pattern: XX.YY.ZZZZZZ where X, Y, Z are digits
        if (/^\d{2}\.\d{2}\.\d{6}$/.test(trimmed)) {
          console.log(`[DEBUG] Detected nomorKTA column by pattern: ${header} (sample: ${trimmed})`)
          mapping.nomorKTA = header
          break
        }
      }
    }
  }

  return { mapping, normalized }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN can import legacy data
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Check file type
    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    const isCsv = fileName.endsWith('.csv')

    if (!isExcel && !isCsv) {
      return NextResponse.json({
        error: 'Invalid file type. Please upload Excel (.xlsx, .xls) or CSV (.csv) file'
      }, { status: 400 })
    }

    // Read file content
    const buffer = await file.arrayBuffer()

    let rawData: any[] = []

    try {
      if (isCsv) {
        // For CSV, use papaparse-like handling with XLSX
        const workbook = XLSX.read(buffer, {
          type: 'buffer',
          cellDates: true,
          codepage: 65001 // UTF-8
        })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        rawData = XLSX.utils.sheet_to_json(worksheet, {
          raw: true,
          dateNF: 'yyyy-mm-dd',
          defval: '',
          rawNumbers: true,
        })
      } else {
        // Parse Excel file
        const workbook = XLSX.read(buffer, {
          type: 'buffer',
          cellDates: true,
          cellText: false,
        })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        rawData = XLSX.utils.sheet_to_json(worksheet, {
          raw: true,
          dateNF: 'yyyy-mm-dd',
          defval: '',
          rawNumbers: true,
        })
      }
    } catch (parseError) {
      console.error('File parsing error:', parseError)
      return NextResponse.json({
        error: 'Failed to parse file. Please check the file format.',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 400 })
    }

    if (rawData.length === 0) {
      return NextResponse.json({
        error: 'File is empty or invalid format'
      }, { status: 400 })
    }

    // Get headers
    const headers = Object.keys(rawData[0])

    // Log for debugging
    console.log('Raw headers:', headers)

    // Map columns
    const { mapping: columnMapping, normalized } = mapColumns(headers, rawData)

    // Debug: Log column mapping for nomorKTA
    console.log('[DEBUG] Column mapping:', {
      nomorKTA: columnMapping.nomorKTA,
      allMappings: columnMapping,
      normalizedHeaders: normalized
    })

    // Check if required columns are present (idIzin is optional for legacy data)
    const requiredColumns = ['nama', 'nik', 'jabatanKerja', 'subklasifikasi', 'jenjang', 'noTelp', 'email', 'alamat']
    const missingColumns = requiredColumns.filter(col => !columnMapping[col])

    if (missingColumns.length > 0) {
      return NextResponse.json({
        error: `Kolom wajib tidak ditemukan: ${missingColumns.join(', ')}`,
        foundColumns: headers,
        expectedColumns: requiredColumns,
        columnMapping,
        normalizedHeaders: normalized,
        suggestion: `Pastikan file memiliki kolom: Nama Lengkap, NIK, Jenjang, Jabatan Kerja, Subklasifikasi, No. Telepon, Email, Alamat. ID Izin opsional.`
      }, { status: 400 })
    }

    // Parse and validate rows
    const parsedRows: ImportedRow[] = []
    const errors: { row: number; error: string; data?: any }[] = []

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]

      try {
        const nama = row[columnMapping.nama]?.toString().trim() || ''
        let nikValue = row[columnMapping.nik]

        // Handle NIK - convert from number or scientific notation
        let nik = ''
        if (typeof nikValue === 'number') {
          nik = nikValue.toString()
          if (nik.includes('e') || nik.includes('E')) {
            nik = Number(nikValue).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 })
          }
        } else {
          nik = (nikValue || '').toString().trim()
          nik = nik.replace(/^'/, '')
        }

        const jabatanKerja = row[columnMapping.jabatanKerja]?.toString().trim() || ''
        const subklasifikasi = row[columnMapping.subklasifikasi]?.toString().trim() || ''
        const jenjang = row[columnMapping.jenjang]?.toString().trim() || ''
        const noTelp = row[columnMapping.noTelp]?.toString().trim() || ''
        const email = row[columnMapping.email]?.toString().trim() || ''
        const alamat = row[columnMapping.alamat]?.toString().trim() || ''

        // idIzin is OPTIONAL for legacy data - can be empty
        const idIzinValue = row[columnMapping.idIzin]
        const idIzin = idIzinValue?.toString().trim() || undefined

        // nomorKTA is OPTIONAL for legacy data - existing KTA number
        const nomorKTAValue = columnMapping.nomorKTA ? row[columnMapping.nomorKTA] : undefined
        const nomorKTA = nomorKTAValue?.toString().trim() || undefined

        // Debug log for nomorKTA - log first few rows regardless of whether nomorKTA exists
        if (i < 3) {
          console.log(`[DEBUG] Row ${i + 1} nomorKTA:`, {
            columnKey: columnMapping.nomorKTA,
            rawValue: nomorKTAValue,
            rawType: typeof nomorKTAValue,
            nomorKTA,
            hasMapping: !!columnMapping.nomorKTA
          })
        }

        const tanggalDaftar = row[columnMapping.tanggalDaftar] ? parseDateValue(row[columnMapping.tanggalDaftar]) : new Date()
        const daerahKode = row[columnMapping.daerahKode]?.toString().trim()

        // Validate required fields
        if (!nama || !nik || !jabatanKerja || !subklasifikasi || !jenjang || !noTelp || !email || !alamat) {
          errors.push({
            row: i + 1,
            error: 'Field wajib tidak boleh kosong',
            data: { nama, nik, jabatanKerja, subklasifikasi, jenjang, noTelp, email, alamat }
          })
          continue
        }

        // Validate NIK format (16 digits) - remove all non-digits first
        const cleanNik = nik.replace(/\D/g, '')
        let finalNik = cleanNik
        if (cleanNik.length < 16) {
          finalNik = cleanNik.padStart(16, '0')
        }

        // Detect Excel precision loss
        const hasPrecisionLoss = /0{5,}$/.test(finalNik) && nikValue !== undefined && typeof nikValue === 'number'

        if (finalNik.length !== 16) {
          errors.push({
            row: i + 1,
            error: `NIK harus 16 digit (ditemukan: ${finalNik.length} digit: "${finalNik}", asli: "${nik}")`,
            data: { nik: finalNik, originalNik: nik }
          })
          continue
        }

        // Warn about potential precision loss
        if (hasPrecisionLoss) {
          errors.push({
            row: i + 1,
            error: `NIK kehilangan presisi akibat format Excel. Solusi: Format kolom NIK sebagai TEXT di Excel.`,
            data: { nik: finalNik, originalNik: nik, nikType: typeof nikValue }
          })
          continue
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({
            row: i + 1,
            error: 'Format email tidak valid',
            data: { email }
          })
          continue
        }

        // Validate jenjang (1-10)
        const jenjangNum = parseInt(jenjang, 10)
        if (isNaN(jenjangNum) || jenjangNum < 1 || jenjangNum > 10) {
          errors.push({
            row: i + 1,
            error: `Jenjang harus 1-10 (ditemukan: ${jenjang})`,
            data: { jenjang }
          })
          continue
        }

        parsedRows.push({
          no: i + 1,
          nama,
          nik: finalNik,
          idIzin, // Can be undefined for legacy data
          nomorKTA, // Can be undefined for legacy data
          jenjang,
          jabatanKerja,
          subklasifikasi,
          noTelp,
          email,
          alamat,
          tanggalDaftar: tanggalDaftar.toISOString(),
          daerahKode,
        })
      } catch (err) {
        console.error(`Error parsing row ${i + 1}:`, err)
        errors.push({
          row: i + 1,
          error: err instanceof Error ? err.message : 'Unknown error',
          data: row
        })
      }
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({
        error: 'Tidak ada data valid yang ditemukan. Mohon periksa error di bawah ini.',
        errors: errors.map(e => ({
          row: e.row,
          error: e.error,
          data: e.data
        })),
        totalRows: rawData.length,
        validRows: 0,
        errorRows: errors.length,
        columnMapping,
        normalizedHeaders: normalized,
      }, { status: 400 })
    }

    // Check for existing NIKs (only check NIK for legacy data, idIzin can be duplicate/null)
    const nikList = parsedRows.map(r => r.nik)

    const existingRecords = await prisma.kTARequest.findMany({
      where: {
        nik: { in: nikList }
      },
      select: {
        nik: true,
        id: true,
        nama: true,
      }
    })

    const duplicates = parsedRows.filter(row =>
      existingRecords.some(e => e.nik === row.nik)
    )

    // Return parsed data for preview (not saving yet)
    return NextResponse.json({
      success: true,
      message: `Berhasil memparse ${parsedRows.length} baris data legacy`,
      data: {
        preview: parsedRows,
        errors,
        duplicates: duplicates.map(d => ({
          nik: d.nik,
          nama: d.nama,
          existingRecord: existingRecords.find(e => e.nik === d.nik)
        })),
        totalRows: rawData.length,
        validRows: parsedRows.length,
        errorRows: errors.length,
        duplicateRows: duplicates.length,
        columnMapping,
      }
    })

  } catch (error) {
    console.error('Import legacy KTA error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Confirm import - actually save the data
export async function PUT(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN can import legacy data
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { rows } = body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data to import' }, { status: 400 })
    }

    // Process each row - daerahId comes from each row (extracted from nomorKTA)
    const results = []
    const errors = []

    for (const row of rows) {
      try {
        // daerahId is required per row (extracted from nomorKTA)
        const finalDaerahId = row.daerahId
        if (!finalDaerahId) {
          errors.push({
            row: row.no,
            nik: row.nik,
            nama: row.nama,
            error: 'Daerah ID tidak ditemukan. Pastikan Nomor KTA diisi dengan format yang benar (XX.YY.ZZZZZZ)'
          })
          continue
        }

        // Get daerah diskon for this specific row's daerah
        const daerah = await prisma.daerah.findUnique({
          where: { id: finalDaerahId },
          select: { diskonPersen: true, kodeDaerah: true }
        })

        const diskonPersen = daerah?.diskonPersen || 0
        const jenjangNum = parseInt(row.jenjang, 10)
        const hargaBase = jenjangNum >= 7 ? 300000 : 100000
        const hargaFinal = Math.floor(hargaBase - (hargaBase * diskonPersen / 100))

        // Create KTA Request for legacy data
        const ktaRequest = await prisma.kTARequest.create({
          data: {
            idIzin: row.idIzin || null, // Can be null for legacy data
            nomorKTA: row.nomorKTA || null, // Can be null for legacy data (existing KTA number)
            nik: row.nik,
            nama: row.nama,
            jabatanKerja: row.jabatanKerja,
            subklasifikasi: row.subklasifikasi,
            jenjang: row.jenjang,
            noTelp: row.noTelp,
            email: row.email,
            alamat: row.alamat,
            ktpUrl: null, // Empty for legacy data
            fotoUrl: null, // Empty for legacy data
            daerahId: finalDaerahId,
            requestedBy: session.user.id,
            status: 'IMPORTED_PENDING_DOCS', // Draft status for legacy data
            hargaRegion: hargaFinal,
            diskonPersen,
            hargaBase: hargaBase,
            hargaFinal: hargaFinal,
            tanggalDaftar: new Date(row.tanggalDaftar),
            isUpgrade: false,
          }
        })

        results.push({
          success: true,
          id: ktaRequest.id,
          nama: ktaRequest.nama,
          nik: ktaRequest.nik,
          jenjang: ktaRequest.jenjang,
          nomorKTA: ktaRequest.nomorKTA,
          daerahId: finalDaerahId,
        })
      } catch (err) {
        console.error(`Error importing legacy row ${row.no}:`, err)
        errors.push({
          row: row.no,
          nik: row.nik,
          nama: row.nama,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${results.length} dari ${rows.length} data legacy`,
      data: {
        imported: results,
        errors,
        total: rows.length,
        success: results.length,
        failed: errors.length,
      }
    })

  } catch (error) {
    console.error('Confirm import legacy KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
