import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

/**
 * POST - Upload and process Excel file for KTA sequence
 */
export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Check file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload Excel file (.xlsx or .xls)' }, { status: 400 })
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 })
    }

    // Validate columns
    const firstRow = jsonData[0] as any
    const requiredColumns = ['Kode Daerah', 'Last Sequence Ahli', 'Last Sequence Teknisi/Analis', 'Last Sequence Operator']
    const missingColumns = requiredColumns.filter(col => !(col in firstRow))

    if (missingColumns.length > 0) {
      return NextResponse.json({
        error: `Missing required columns: ${missingColumns.join(', ')}`
      }, { status: 400 })
    }

    // Process each row
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const row of jsonData) {
      const kodeDaerah = row['Kode Daerah']
      const lastSequenceAhli = parseInt(row['Last Sequence Ahli']) || 0
      const lastSequenceTeknisi = parseInt(row['Last Sequence Teknisi/Analis']) || 0
      const lastSequenceOperator = parseInt(row['Last Sequence Operator']) || 0

      try {
        // Find daerah by kodeDaerah
        const daerah = await prisma.daerah.findFirst({
          where: { kodeDaerah: String(kodeDaerah) }
        })

        if (!daerah) {
          results.push({
            kodeDaerah,
            status: 'error',
            message: 'Daerah not found'
          })
          errorCount++
          continue
        }

        // Update sequence
        await prisma.daerah.update({
          where: { id: daerah.id },
          data: {
            lastSequenceAhli,
            lastSequenceTeknisi,
            lastSequenceOperator,
          }
        })

        results.push({
          kodeDaerah,
          namaDaerah: daerah.namaDaerah,
          status: 'success',
          data: {
            lastSequenceAhli,
            lastSequenceTeknisi,
            lastSequenceOperator,
          }
        })
        successCount++

      } catch (error: any) {
        results.push({
          kodeDaerah,
          status: 'error',
          message: error.message || 'Unknown error'
        })
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import completed: ${successCount} success, ${errorCount} errors`,
      summary: {
        total: jsonData.length,
        success: successCount,
        error: errorCount,
      },
      results
    })

  } catch (error) {
    console.error('Import KTA sequence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
