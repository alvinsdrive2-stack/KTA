import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { checkUpgradeScenario } from '@/lib/kta-upgrade'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

interface ImportedRow {
  no: number
  nama: string
  nik: string
  idIzin: string
  jenjang: string
  jabatanKerja: string
  subklasifikasi: string
  noTelp: string
  email: string
  alamat: string
  tanggalDaftar: string
  daerahKode?: string
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
function mapColumns(headers: string[]): { mapping: Record<string, string>; normalized: Record<string, string> } {
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
    idIzin: ['ID_IZIN', 'IDIZIN', 'NOMOR_KTA', 'NOKTA', 'NO_KTA', 'KTA', 'REGISTRATION_NUMBER'],
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

  return { mapping, normalized }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
          raw: true, // Get raw values to preserve numbers
          dateNF: 'yyyy-mm-dd',
          defval: '', // Default value for empty cells
          rawNumbers: true, // Preserve raw number values
        })
      } else {
        // Parse Excel file
        const workbook = XLSX.read(buffer, {
          type: 'buffer',
          cellDates: true,
          cellText: false, // Don't convert to text automatically
        })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        rawData = XLSX.utils.sheet_to_json(worksheet, {
          raw: true, // Get raw values
          dateNF: 'yyyy-mm-dd',
          defval: '',
          rawNumbers: true, // Preserve raw number values
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
    console.log('First row sample:', rawData[0])

    // Map columns
    const { mapping: columnMapping, normalized } = mapColumns(headers)

    console.log('Column mapping:', columnMapping)
    console.log('Normalized headers:', normalized)

    // Check if required columns are present
    const requiredColumns = ['nama', 'nik', 'jabatanKerja', 'subklasifikasi', 'jenjang', 'noTelp', 'email', 'alamat']
    const missingColumns = requiredColumns.filter(col => !columnMapping[col])

    if (missingColumns.length > 0) {
      return NextResponse.json({
        error: `Kolom wajib tidak ditemukan: ${missingColumns.join(', ')}`,
        foundColumns: headers,
        expectedColumns: requiredColumns,
        columnMapping,
        normalizedHeaders: normalized,
        suggestion: `Pastikan file memiliki kolom: Nama Lengkap, NIK, Jenjang, Jabatan Kerja, Subklasifikasi, No. Telepon, Email, Alamat`
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
          // Convert number to string, handle scientific notation
          nik = nikValue.toString()
          // If contains E (scientific notation), convert properly
          if (nik.includes('e') || nik.includes('E')) {
            nik = Number(nikValue).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 })
          }
          // Log warning for number-type NIK (precision may be lost)
          if (i === 0) {
            console.warn('NIK column detected as number type in Excel. For accurate NIK values, format the column as TEXT in Excel.')
          }
        } else {
          nik = (nikValue || '').toString().trim()
          // Strip leading apostrophe (Excel text marker)
          nik = nik.replace(/^'/, '')
        }

        const jabatanKerja = row[columnMapping.jabatanKerja]?.toString().trim() || ''
        const subklasifikasi = row[columnMapping.subklasifikasi]?.toString().trim() || ''
        const jenjang = row[columnMapping.jenjang]?.toString().trim() || ''
        const noTelp = row[columnMapping.noTelp]?.toString().trim() || ''
        const email = row[columnMapping.email]?.toString().trim() || ''
        const alamat = row[columnMapping.alamat]?.toString().trim() || ''
        const idIzin = row[columnMapping.idIzin]?.toString().trim() || `I${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        const tanggalDaftar = row[columnMapping.tanggalDaftar] ? parseDateValue(row[columnMapping.tanggalDaftar]) : new Date()
        const daerahKode = row[columnMapping.daerahKode]?.toString().trim()

        // Log sample of first row for debugging
        if (i === 0) {
          console.log('Sample parsed data:', {
            nama, nik, nikValue, nikType: typeof nikValue, jabatanKerja, subklasifikasi, jenjang, noTelp, email, alamat
          })
        }

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
        const cleanNik = nik.replace(/\D/g, '') // Remove non-digits

        // Pad with leading zeros if needed (in case Excel stripped them)
        let finalNik = cleanNik
        if (cleanNik.length < 16) {
          finalNik = cleanNik.padStart(16, '0')
        }

        // Detect Excel precision loss (if NIK ends with many zeros)
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
            error: `NIK kehilangan presisi akibat format Excel. Nilai terdeteksi: "${finalNik}". Solusi: Format kolom NIK sebagai TEXT di Excel (klik kanan > Format Cells > Text), lalu input ulang NIK dengan awalan tanda petik satu (') contoh: '1234567890123456`,
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
          idIzin,
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
        hint: 'Semua baris memiliki error. Silakan periksa: NIK harus 16 digit, email harus valid, jenjang 1-10, dan semua field wajib terisi.'
      }, { status: 400 })
    }

    // Get user's daerah
    let userDaerahId = session.user.daerahId

    // If user is DAERAH role, get their daerah
    if (session.user.role === 'DAERAH' && !userDaerahId) {
      return NextResponse.json({ error: 'Anda belum di-assign ke daerah' }, { status: 400 })
    }

    // Check for existing NIKs or ID Izins
    const nikList = parsedRows.map(r => r.nik)
    const idIzinList = parsedRows.map(r => r.idIzin)

    const existingRecords = await prisma.kTARequest.findMany({
      where: {
        OR: [
          { nik: { in: nikList } },
          { idIzin: { in: idIzinList } },
        ]
      },
      select: {
        nik: true,
        idIzin: true,
        nama: true,
      }
    })

    const duplicates = parsedRows.filter(row =>
      existingRecords.some(e => e.nik === row.nik || e.idIzin === row.idIzin)
    )

    // Return parsed data for preview (not saving yet)
    return NextResponse.json({
      success: true,
      message: `Berhasil memparse ${parsedRows.length} baris data`,
      data: {
        preview: parsedRows,
        errors,
        duplicates: duplicates.map(d => ({
          nik: d.nik,
          idIzin: d.idIzin,
          nama: d.nama,
          existingRecord: existingRecords.find(e => e.nik === d.nik || e.idIzin === d.idIzin)
        })),
        totalRows: rawData.length,
        validRows: parsedRows.length,
        errorRows: errors.length,
        duplicateRows: duplicates.length,
        columnMapping,
        userDaerahId,
      }
    })

  } catch (error) {
    console.error('Import KTA error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
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

    const body = await request.json()
    const { rows, daerahId } = body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data to import' }, { status: 400 })
    }

    // Determine daerah
    let finalDaerahId = daerahId || session.user.daerahId

    if (!finalDaerahId) {
      return NextResponse.json({ error: 'Daerah is required' }, { status: 400 })
    }

    // Get daerah diskon
    const daerah = await prisma.daerah.findUnique({
      where: { id: finalDaerahId },
      select: { diskonPersen: true, kodeDaerah: true }
    })

    const diskonPersen = daerah?.diskonPersen || 0

    // Process each row
    const results = []
    const errors = []

    for (const row of rows) {
      try {
        const jenjangNum = parseInt(row.jenjang, 10)
        const hargaBase = jenjangNum >= 7 ? 300000 : 100000
        const hargaFinal = Math.floor(hargaBase - (hargaBase * diskonPersen / 100))

        // Check for upgrade scenario
        const upgradeCheck = await checkUpgradeScenario(
          row.nik,
          jenjangNum,
          row.subklasifikasi
        )

        if (!upgradeCheck.canUpgrade) {
          errors.push({
            row: row.no,
            nik: row.nik,
            nama: row.nama,
            error: upgradeCheck.reason || 'Tidak dapat membuat permohonan KTA'
          })
          continue
        }

        // Calculate final price
        let finalHargaBase = hargaBase
        let finalHargaFinal = hargaFinal
        let finalHargaUpgrade: number | undefined
        let finalHargaLama: number | undefined

        if (upgradeCheck.isUpgrade) {
          finalHargaBase = upgradeCheck.hargaBaru
          // Upgrade fee = hargaBaru - hargaLama, then apply discount to the upgrade fee
          finalHargaFinal = upgradeCheck.hargaUpgrade - (upgradeCheck.hargaUpgrade * diskonPersen / 100)
          finalHargaUpgrade = upgradeCheck.hargaUpgrade
          finalHargaLama = upgradeCheck.hargaLama
        }

        // Create KTA Request (without KTP and Foto - will be uploaded later)
        const ktaRequest = await prisma.kTARequest.create({
          data: {
            idIzin: row.idIzin,
            nik: row.nik,
            nama: row.nama,
            jabatanKerja: row.jabatanKerja,
            subklasifikasi: row.subklasifikasi,
            jenjang: row.jenjang,
            noTelp: row.noTelp,
            email: row.email,
            alamat: row.alamat,
            ktpUrl: '', // Empty initially, will be uploaded later
            fotoUrl: '', // Empty initially, will be uploaded later
            daerahId: finalDaerahId,
            requestedBy: session.user.id,
            status: 'IMPORTED_PENDING_DOCS', // Special status for imported records
            hargaRegion: finalHargaFinal,
            diskonPersen,
            hargaBase: finalHargaBase,
            hargaFinal: finalHargaFinal,
            tanggalDaftar: new Date(row.tanggalDaftar),
            isUpgrade: upgradeCheck.isUpgrade,
            upgradeFromKtaId: upgradeCheck.existingKta?.id,
            hargaLama: finalHargaLama,
            hargaUpgrade: finalHargaUpgrade,
          }
        })

        results.push({
          success: true,
          id: ktaRequest.id,
          nama: ktaRequest.nama,
          nik: ktaRequest.nik,
          idIzin: ktaRequest.idIzin,
          jenjang: ktaRequest.jenjang,
          jabatanKerja: ktaRequest.jabatanKerja,
          subklasifikasi: ktaRequest.subklasifikasi,
          noTelp: ktaRequest.noTelp,
        })
      } catch (err) {
        console.error(`Error importing row ${row.no}:`, err)
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
      message: `Berhasil mengimpor ${results.length} dari ${rows.length} data`,
      data: {
        imported: results,
        errors,
        total: rows.length,
        success: results.length,
        failed: errors.length,
      }
    })

  } catch (error) {
    console.error('Confirm import KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
