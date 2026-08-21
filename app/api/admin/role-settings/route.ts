import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

const ALL_ROLES: UserRole[] = ['DAERAH', 'PUSAT', 'ADMIN', 'KEUANGAN']

// GET - List max device per role
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Anda tidak memiliki akses' }, { status: 403 })
    }

    const settings = await prisma.roleSetting.findMany()
    const byRole = new Map(settings.map(s => [s.role, s.maxDevices]))

    const data = ALL_ROLES.map(role => ({
      role,
      maxDevices: byRole.get(role) ?? 1,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Get role settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT - Update max device untuk satu role
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Anda tidak memiliki akses' }, { status: 403 })
    }

    const body = await request.json()
    const { role, maxDevices } = body

    if (!ALL_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Role tidak valid' }, { status: 400 })
    }

    const parsed = parseInt(maxDevices, 10)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { success: false, error: 'Max device harus antara 1 - 100' },
        { status: 400 }
      )
    }

    const setting = await prisma.roleSetting.upsert({
      where: { role },
      update: { maxDevices: parsed },
      create: { role, maxDevices: parsed },
    })

    return NextResponse.json({ success: true, data: setting })
  } catch (error) {
    console.error('Update role setting error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
