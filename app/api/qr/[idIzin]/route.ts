import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { idIzin: string } }
) {
  try {
    const { idIzin } = params
    console.log('Fetching KTA for ID:', idIzin)

    // Find KTA request data by idIzin
    const ktaData = await prisma.kTARequest.findUnique({
      where: {
        idIzin: idIzin
      },
      include: {
        requestedByUser: {
          select: {
            name: true,
            email: true,
            daerah: true
          }
        },
        daerah: {
          select: {
            namaDaerah: true
          }
        },
        qrScans: {
          orderBy: {
            scannedAt: 'desc'
          },
          take: 10
        }
      }
    })

    if (!ktaData) {
      return NextResponse.json({
        success: false,
        error: 'Permohonan dengan ID Izin tersebut tidak ditemukan. Pastikan ID Izin valid dan KTA sudah disetujui.'
      }, { status: 404 })
    }

    // Add new scan record
    await prisma.qRScan.create({
      data: {
        ktaRequestId: ktaData.id,
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // Get updated scan count
    const scanCount = await prisma.qRScan.count({
      where: {
        ktaRequestId: ktaData.id
      }
    })

    // Get recent scans
    const recentScans = await prisma.qRScan.findMany({
      where: {
        ktaRequestId: ktaData.id
      },
      orderBy: {
        scannedAt: 'desc'
      },
      take: 10
    })

    // Format response data
    const responseData = {
      idIzin: ktaData.idIzin,
      nama: ktaData.nama,
      nik: ktaData.nik,
      jabatanKerja: ktaData.jabatanKerja,
      subklasifikasi: ktaData.subklasifikasi,
      jenjang: ktaData.jenjang,
      daerah: ktaData.daerah?.namaDaerah || ktaData.requestedByUser?.daerah || '',
      status: ktaData.status,
      tanggalTerbit: ktaData.pusatApprovedAt || ktaData.createdAt,
      totalScans: scanCount,
      qrCodePath: ktaData.qrCodePath || null,
      kartuGeneratedPath: ktaData.kartuGeneratedPath || null,
      recentScans: recentScans.map(scan => ({
        ipAddress: scan.ipAddress,
        scannedAt: scan.scannedAt
      }))
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('Error fetching KTA data:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}