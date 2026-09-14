import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { appUrl, isEmailConfigured, sendMail, renderSetPasswordEmail } from '@/lib/email'
import { createPasswordResetToken, SET_PASSWORD_TOKEN_TTL_MINUTES } from '@/lib/password-reset'

export const dynamic = 'force-dynamic'

// GET - Fetch all users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Only ADMIN can access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const daerahId = searchParams.get('daerahId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { daerah: { namaDaerah: { contains: search } } }
      ]
    }
    if (role) {
      where.role = role
    }
    if (daerahId) {
      where.daerahId = daerahId
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          daerahId: true,
          daerah: {
            select: {
              namaDaerah: true,
              kodeDaerah: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Only ADMIN can access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, email, password, role, daerahId } = body

    // Validation — password nggak wajib lagi, user bikin sendiri lewat link.
    if (!name || !email || !role) {
      return NextResponse.json(
        { success: false, error: 'Nama, email, dan role harus diisi' },
        { status: 400 }
      )
    }

    // DAERAH role must have daerahId
    if (role === 'DAERAH' && !daerahId) {
      return NextResponse.json(
        { success: false, error: 'Daerah harus dipilih untuk role BPD' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email sudah terdaftar' },
        { status: 400 }
      )
    }

    // Kalau admin tetap ngisi password, itu yang dipakai. Kalau nggak, bikin
    // password acak 32 byte yang nggak pernah dikasih ke siapa pun — akunnya
    // cuma bisa dipakai setelah user bikin password sendiri lewat link email.
    const initialPassword = password || randomBytes(32).toString('hex')

    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash(initialPassword, 10)

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        daerahId,
        // Password awal dari admin -> user wajib ganti saat login pertama.
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        daerahId: true,
        daerah: {
          select: {
            namaDaerah: true,
            kodeDaerah: true,
          },
        },
        createdAt: true,
      },
    })

    // Kabarin user-nya kalau email dikonfigurasi. Kegagalan kirim TIDAK boleh
    // bikin pembuatan akun dianggap gagal — akunnya udah jadi di DB.
    //
    // Yang dikirim LINK buat bikin password sendiri, bukan password. Token
    // mentahnya cuma ada di email ini; yang masuk DB cuma hash-nya.
    if (isEmailConfigured()) {
      try {
        const { rawToken } = await createPasswordResetToken(
          newUser.id,
          SET_PASSWORD_TOKEN_TTL_MINUTES
        )
        const { subject, html } = renderSetPasswordEmail({
          name: newUser.name,
          email: newUser.email,
          setPasswordUrl: appUrl(`/auth/reset-password?token=${rawToken}`),
          expiresMinutes: SET_PASSWORD_TOKEN_TTL_MINUTES,
        })
        await sendMail({ to: newUser.email, subject, html })
      } catch (mailError) {
        console.error('Create user: gagal kirim link set password', mailError)
      }
    } else {
      console.warn('Create user: SMTP belum dikonfigurasi, link set password dilewati')
    }

    return NextResponse.json({ success: true, data: newUser }, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
