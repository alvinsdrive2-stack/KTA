import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

/**
 * GET - Download Excel template for KTA sequence upload
 */
export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all daerah for template
    const daerahList = await prisma.daerah.findMany({
      select: {
        kodeDaerah: true,
        namaDaerah: true,
        lastSequenceAhli: true,
        lastSequenceTeknisi: true,
        lastSequenceOperator: true,
      },
      orderBy: { kodeDaerah: 'asc' }
    })

    // Create template data
    const templateData = daerahList.map((d) => ({
      'Kode Daerah': d.kodeDaerah,
      'Nama Daerah': d.namaDaerah,
      'Last Sequence Ahli': d.lastSequenceAhli,
      'Last Sequence Teknisi/Analis': d.lastSequenceTeknisi,
      'Last Sequence Operator': d.lastSequenceOperator,
    }))

    // Add header row as first row
    const worksheet = XLSX.utils.json_to_sheet(templateData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Kode Daerah
      { wch: 30 }, // Nama Daerah
      { wch: 20 }, // Last Sequence Ahli
      { wch: 20 }, // Last Sequence Teknisi/Analis
      { wch: 20 }, // Last Sequence Operator
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KTA Sequence')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="kta-sequence-template-${Date.now()}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Download template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
