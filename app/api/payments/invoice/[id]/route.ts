import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoice = await prisma.bulkPayment.findUnique({
      where: { id: params.id },
      include: {
        daerah: {
          select: {
            namaDaerah: true,
            kodeDaerah: true,
            alamat: true,
            telepon: true,
            email: true,
            diskonPersen: true
          }
        },
        submittedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        verifiedByUser: {
          select: {
            id: true,
            name: true
          }
        },
        payments: {
          include: {
            ktaRequest: {
              select: {
                id: true,
                idIzin: true,
                nama: true,
                nik: true,
                jenjang: true,
                jabatanKerja: true,
                hargaBase: true,
                hargaFinal: true,
                isUpgrade: true,
                upgradeFromKtaId: true
              }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch previous KTA data for upgrades
    const upgradedKtaIds = invoice.payments
      .filter(p => p.ktaRequest.isUpgrade && p.ktaRequest.upgradeFromKtaId)
      .map(p => p.ktaRequest.upgradeFromKtaId!)

    let previousKtas: Record<string, { hargaBase: number; hargaFinal: number; jenjang: string }> = {}

    if (upgradedKtaIds.length > 0) {
      const prevKtas = await prisma.kTARequest.findMany({
        where: {
          id: { in: upgradedKtaIds }
        },
        select: {
          id: true,
          hargaBase: true,
          hargaFinal: true,
          jenjang: true
        }
      })

      previousKtas = prevKtas.reduce((acc, kta) => {
        acc[kta.id] = {
          hargaBase: kta.hargaBase || 0,
          hargaFinal: kta.hargaFinal || 0,
          jenjang: kta.jenjang
        }
        return acc
      }, {} as Record<string, { hargaBase: number; hargaFinal: number; jenjang: string }>)
    }

    // Attach previous KTA data to payments
    const paymentsWithPrev = invoice.payments.map(p => {
      const prevData = p.ktaRequest.isUpgrade && p.ktaRequest.upgradeFromKtaId
        ? previousKtas[p.ktaRequest.upgradeFromKtaId]
        : null
      return {
        ...p,
        ktaRequest: {
          ...p.ktaRequest,
          previousKta: prevData
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...invoice,
        payments: paymentsWithPrev
      }
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
