import { test, describe, expect } from './helpers/assert'
import { prisma } from '@/lib/prisma'

describe('backfillEmptyFields() — jalur fotoData doang', async () => {
  test('fotoData keisi tapi field lain semua penuh -> update tetap harus jalan', async () => {
    let updateDipanggil = false
    const row: any = {
      id: 'k1', nik: '3201010101010001', jenjang: '5', status: 'PRINTED',
      nama: 'NAMA LENGKAP', jabatanKerja: 'Ahli', subklasifikasiId: 'sub-1',
      subklasifikasi: 'GK001', noTelp: '0812', email: 'a@b.c', alamat: 'Jl. Mawar',
      ktpUrl: '/uploads/ktp.jpg', fotoUrl: '/uploads/foto.jpg',
      fotoData: null, // satu-satunya yang kosong
    }
    const d: any = prisma
    d.kTARequest = {
      findUnique: async () => row,
      update: async (args: any) => { updateDipanggil = true; Object.assign(row, args.data); return row },
      findFirst: async () => null,
    }
    d.subklasifikasi = { findUnique: async () => ({ subklasifikasi: 'GK001' }), create: async () => null, update: async () => null }

    const { backfillEmptyFields } = await import('@/lib/kta-upgrade')
    const hasil = await backfillEmptyFields('k1', {
      nik: '3201010101010001', nama: 'SIKI', jabatan: 'SIKI', subklasifikasi: 'GK001',
      jenjang: 5, telp: 'SIKI', email: 'SIKI', alamat: 'SIKI',
      ktpUrl: null, fotoUrl: null, fotoData: 'BASE64FOTOBARU',
    } as any)

    console.log('update dipanggil?', updateDipanggil)
    console.log('fotoData di row sesudah?', row.fotoData)
    console.log('hasil balikin:', JSON.stringify(hasil))
    expect.toBe(updateDipanggil, true, 'update HARUS dipanggil kalau fotoData keisi')
  })
})
