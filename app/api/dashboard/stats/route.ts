import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userDaerahId = session.user?.daerahId

    // Build where clause based on user role
    let whereClause: any = {}

    switch (userRole) {
      case 'DAERAH':
        if (userDaerahId) {
          whereClause.daerahId = userDaerahId
        } else {
          return NextResponse.json({
            success: true,
            stats: {
              totalKTA: 0,
              draftKTA: 0,
              waitingPayment: 0,
              waitingApproval: 0,
              approvedKTA: 0,
              printedKTA: 0,
              totalAhli: 0,
              totalTeknisi: 0,
              totalOperator: 0,
              growthAhli: 0,
              growthTeknisi: 0,
              growthOperator: 0,
              overallGrowth: 0,
            }
          })
        }
        break
      case 'PUSAT':
      case 'ADMIN':
      case 'KEUANGAN':
        // Can see all requests
        break
      default:
        return NextResponse.json({
          success: true,
          stats: {
            totalKTA: 0,
            draftKTA: 0,
            waitingPayment: 0,
            waitingApproval: 0,
            approvedKTA: 0,
            printedKTA: 0,
            totalAhli: 0,
            totalTeknisi: 0,
            totalOperator: 0,
            growthAhli: 0,
            growthTeknisi: 0,
            growthOperator: 0,
            overallGrowth: 0,
          }
        })
    }

    // Get all KTA counts by status
    const [
      totalCount,
      draftCount,
      waitingPaymentCount,
      waitingApprovalCount,
      approvedCount,
      printedCount,
      // Approved KTA with jenjang for breakdown
      approvedKTA,
    ] = await Promise.all([
      prisma.kTARequest.count({ where: whereClause }),
      prisma.kTARequest.count({ where: { ...whereClause, status: 'DRAFT' } }),
      prisma.kTARequest.count({ where: { ...whereClause, status: 'WAITING_PAYMENT' } }),
      // waitingApproval uses DRAFT status based on original code
      prisma.kTARequest.count({ where: { ...whereClause, status: 'DRAFT' } }),
      prisma.kTARequest.count({
        where: {
          ...whereClause,
          status: { in: ['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED'] }
        }
      }),
      prisma.kTARequest.count({
        where: {
          ...whereClause,
          status: { in: ['READY_TO_PRINT', 'PRINTED'] }
        }
      }),
      // Get approved KTA with jenjang for breakdown
      prisma.kTARequest.findMany({
        where: {
          ...whereClause,
          status: { in: ['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED'] }
        },
        select: {
          createdAt: true,
          jenjang: true,
        },
      }),
    ])

    // Calculate qualification breakdown based on jenjang
    let totalAhli = 0
    let totalTeknisi = 0
    let totalOperator = 0

    approvedKTA.forEach((kta) => {
      const jenjangNum = parseInt(kta.jenjang, 10)
      if (jenjangNum >= 1 && jenjangNum <= 3) {
        totalOperator++
      } else if (jenjangNum >= 4 && jenjangNum <= 6) {
        totalTeknisi++
      } else if (jenjangNum >= 7 && jenjangNum <= 9) {
        totalAhli++
      }
    })

    // Calculate growth (this month vs previous month)
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    const thisMonthKTA = approvedKTA.filter((kta) => {
      const ktaDate = new Date(kta.createdAt)
      return ktaDate.getMonth() === thisMonth && ktaDate.getFullYear() === thisYear
    })

    let thisMonthAhli = 0
    let thisMonthTeknisi = 0
    let thisMonthOperator = 0

    thisMonthKTA.forEach((kta) => {
      const jenjangNum = parseInt(kta.jenjang, 10)
      if (jenjangNum >= 1 && jenjangNum <= 3) {
        thisMonthOperator++
      } else if (jenjangNum >= 4 && jenjangNum <= 6) {
        thisMonthTeknisi++
      } else if (jenjangNum >= 7 && jenjangNum <= 9) {
        thisMonthAhli++
      }
    })

    // Previous month
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

    const prevMonthKTA = approvedKTA.filter((kta) => {
      const ktaDate = new Date(kta.createdAt)
      return ktaDate.getMonth() === prevMonth && ktaDate.getFullYear() === prevMonthYear
    })

    let prevMonthAhli = 0
    let prevMonthTeknisi = 0
    let prevMonthOperator = 0

    prevMonthKTA.forEach((kta) => {
      const jenjangNum = parseInt(kta.jenjang, 10)
      if (jenjangNum >= 1 && jenjangNum <= 3) {
        prevMonthOperator++
      } else if (jenjangNum >= 4 && jenjangNum <= 6) {
        prevMonthTeknisi++
      } else if (jenjangNum >= 7 && jenjangNum <= 9) {
        prevMonthAhli++
      }
    })

    // Calculate growth percentages
    const growthAhli = prevMonthAhli > 0 ? ((thisMonthAhli - prevMonthAhli) / prevMonthAhli) * 100 : (thisMonthAhli > 0 ? 100 : 0)
    const growthTeknisi = prevMonthTeknisi > 0 ? ((thisMonthTeknisi - prevMonthTeknisi) / prevMonthTeknisi) * 100 : (thisMonthTeknisi > 0 ? 100 : 0)
    const growthOperator = prevMonthOperator > 0 ? ((thisMonthOperator - prevMonthOperator) / prevMonthOperator) * 100 : (thisMonthOperator > 0 ? 100 : 0)

    // Calculate overall growth from total counts
    const prevMonthTotal = prevMonthAhli + prevMonthTeknisi + prevMonthOperator
    const thisMonthTotal = thisMonthAhli + thisMonthTeknisi + thisMonthOperator
    const overallGrowth = prevMonthTotal > 0 ? ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : (thisMonthTotal > 0 ? 100 : 0)

    return NextResponse.json({
      success: true,
      stats: {
        totalKTA: totalCount,
        draftKTA: draftCount,
        waitingPayment: waitingPaymentCount,
        waitingApproval: waitingApprovalCount,
        approvedKTA: approvedCount,
        printedKTA: printedCount,
        totalAhli,
        totalTeknisi,
        totalOperator,
        growthAhli: Math.round(growthAhli),
        growthTeknisi: Math.round(growthTeknisi),
        growthOperator: Math.round(growthOperator),
        overallGrowth: Math.round(overallGrowth),
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
