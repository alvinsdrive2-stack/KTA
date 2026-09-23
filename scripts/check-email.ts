/**
 * Cek SMTP beneran jalan apa nggak — dipakai buat ngejawab "emailnya kekirim
 * nggak?" pas bikin user baru.
 *
 * Kenapa perlu script sendiri: `POST /api/admin/users` sengaja nggak ngegagalin
 * pembuatan akun waktu emailnya gagal — akunnya udah keburu jadi di DB, jadi
 * mending akunnya jalan daripada di-rollback cuma gara-gara SMTP. Efeknya, kalau
 * SMTP salah, response-nya tetap `{ success: true }` dan gagalnya cuma nyampe
 * log server. Script ini mastiin SMTP-nya dulu, sebelum nyalahin kode lain.
 *
 * Tiga lapis yang dicek, dari yang paling murah:
 *   1. Env-nya keisi apa nggak, dan link yang bakal masuk email ngarah ke mana.
 *   2. Handshake + login ke SMTP (nggak ada email yang kekirim).
 *   3. Kirim email beneran pakai template aslinya, kalau diminta.
 *
 * Pakai:
 *   npm run check-email
 *   npm run check-email -- --to=alvin@gatensi.or.id
 *   npm run check-email -- --user=alvin@gatensi.or.id      lihat token terakhir
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import {
  appUrl,
  isEmailConfigured,
  renderSetPasswordEmail,
  sendMail,
  verifyEmailTransport,
} from '../lib/email'

/** `--nama=nilai` dari argv. Buat CLI kecil begini nggak perlu parser. */
function arg(nama: string): string | null {
  const prefiks = `--${nama}=`
  const ketemu = process.argv.find((a) => a.startsWith(prefiks))
  return ketemu ? ketemu.slice(prefiks.length) : null
}

function baris(label: string, nilai: string) {
  console.log(`  ${label.padEnd(15)} : ${nilai}`)
}

function tebal(teks: string) {
  console.log(`\n${teks}`)
}

/**
 * Nilai env yang dipakai `lib/email.ts` — dibaca langsung, bukan lewat
 * smtpConfig() yang internal. Tujuannya biar kelihatan mana yang di-set eksplisit
 * di .env dan mana yang jatuh ke default.
 *
 * SMTP_PASS sengaja CUMA ditampilin panjangnya. Script ini sering dijalanin
 * sambil layar kebagi atau di-paste ke chat, dan nilainya nggak nambah informasi
 * apa pun di sini — yang penting dia keisi.
 */
function cekEnv() {
  tebal('▸ Konfigurasi')

  const host = process.env.SMTP_HOST || 'smtp.gmail.com (default)'
  const port = process.env.SMTP_PORT || '587 (default)'
  const secure = process.env.SMTP_SECURE || `kosong — otomatis ${port === '465'}`
  const user = process.env.SMTP_USER || 'BELUM DIISI'
  const pass = process.env.SMTP_PASS || ''
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'BELUM DIISI'
  const fromName = process.env.SMTP_FROM_NAME || 'GATENSI (default)'

  baris('SMTP_HOST', host)
  baris('SMTP_PORT', port)
  baris('SMTP_SECURE', secure)
  baris('SMTP_USER', user)
  baris('SMTP_PASS', pass ? `keisi, ${pass.length} karakter` : 'BELUM DIISI')

  // App password Google itu 16 huruf, tapi sering di-paste pakai spasi
  // ("abcd efgh ijkl mnop"). Google nerima dua-duanya — jadi panjang 19 dengan
  // spasi di posisi 4/9/14 itu bukan salah ketik.
  const passTanpaSpasi = pass.replace(/\s/g, '')
  if (pass && passTanpaSpasi.length !== 16) {
    baris('', `! panjang tanpa spasi ${passTanpaSpasi.length}, app password Google biasanya 16`)
  }

  baris('SMTP_FROM', from)
  baris('SMTP_FROM_NAME', fromName)

  // Link di email dibangun dari sini. Salah set = emailnya kekirim tapi tombolnya
  // ngarah ke localhost, dan itu kelihatan kayak "email nggak jalan" padahal jalan.
  const linkActivate = appUrl('/auth/reset-password?token=CONTOH')
  baris('NEXTAUTH_URL', process.env.NEXTAUTH_URL || '(kosong — jatuh ke localhost)')
  baris('link di email', linkActivate)

  if (linkActivate.startsWith('http://localhost')) {
    console.log('  ! Linknya ngarah ke localhost. Set NEXTAUTH_URL ke domain server.')
  }
}

async function cekTransport() {
  tebal('▸ Koneksi & login SMTP')

  if (!isEmailConfigured()) {
    console.log('  ✗ SMTP_USER / SMTP_PASS belum diisi — email pasti nggak kekirim.')
    console.log('    Ini juga yang bikin token set-password nggak pernah dibikin')
    console.log('    (lihat `isEmailConfigured()` di app/api/admin/users/route.ts:189).')
    return false
  }

  const hasil = await verifyEmailTransport()

  if (hasil.ok) {
    console.log('  ✓ Handshake + login diterima server SMTP. Kredensialnya bener.')
    return true
  }

  console.log(`  ✗ Gagal: ${hasil.error}`)
  console.log('')
  console.log('    Yang paling sering bikin ini:')
  console.log('      - SMTP_PASS isinya password login akun, bukan App Password')
  console.log('        (Google Workspace nolak password akun biasa buat SMTP)')
  console.log('      - port 587 diblokir provider server — coba SMTP_PORT=465 SMTP_SECURE=true')
  console.log('      - 2FA di akun Google-nya belum aktif, jadi menu App Password nggak ada')
  return false
}

async function kirimPercobaan(tujuan: string) {
  tebal(`▸ Kirim email percobaan ke ${tujuan}`)

  const { subject, html } = renderSetPasswordEmail({
    name: 'Percobaan',
    email: tujuan,
    setPasswordUrl: appUrl('/auth/reset-password?token=ini-cuma-contoh'),
    expiresMinutes: 60 * 24 * 7,
  })

  try {
    const info = await sendMail({ to: tujuan, subject, html })
    console.log('  ✓ Diterima server SMTP.')
    baris('messageId', String(info.messageId))
    baris('response', String(info.response || '-').split('\n')[0])
    console.log('')
    console.log('    "Diterima server SMTP" artinya server-nya nggak nolak. Yang mastiin')
    console.log('    beneran nyampe inbox itu cek emailnya — termasuk folder Spam.')
    return true
  } catch (error) {
    console.log(`  ✗ Gagal: ${(error as Error).message}`)
    return false
  }
}

/**
 * Lihat jejak token set-password punya satu user.
 *
 * Arah kesimpulannya satu arah, jangan dibalik:
 *   - token ADA      -> SMTP-nya keisi waktu itu, tapi BELUM tentu emailnya nyampe.
 *                       Tokennya dibikin tepat SEBELUM sendMail() dipanggil, jadi
 *                       kalau sendMail-nya gagal, row-nya tetap ada.
 *   - token NGGAK ADA -> emailnya pasti nggak pernah dikirim.
 */
async function cekToken(email: string) {
  tebal(`▸ Jejak token buat ${email}`)

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true, mustChangePassword: true },
  })

  if (!user) {
    console.log('  ✗ User-nya nggak ada di DB.')
    return
  }

  baris('nama', user.name)
  baris('aktif', user.isActive ? 'ya' : 'TIDAK')
  baris('wajib ganti pw', user.mustChangePassword ? 'ya — belum bikin password sendiri' : 'nggak')

  const token = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  if (!token) {
    console.log('  ✗ Nggak ada token sama sekali.')
    console.log('    Artinya email set-password nggak pernah dikirim buat user ini —')
    console.log('    paling sering karena SMTP_USER/SMTP_PASS kosong waktu akunnya dibikin.')
    return
  }

  const sekarang = Date.now()
  let status: string
  if (token.usedAt) status = `udah dipakai ${token.usedAt.toISOString()}`
  else if (token.expiresAt.getTime() < sekarang) status = 'kadaluwarsa'
  else status = 'masih berlaku'

  baris('dibikin', token.createdAt.toISOString())
  baris('kedaluwarsa', token.expiresAt.toISOString())
  baris('dipakai', token.usedAt ? token.usedAt.toISOString() : 'belum')
  baris('status', status)
  console.log('')
  console.log('  Token ada = SMTP-nya keisi waktu itu. Belum tentu emailnya nyampe —')
  console.log('  pastikan lewat inbox user-nya atau log server.')
}

async function main() {
  const ke = arg('to')
  const lihatUser = arg('user')

  console.log('\nCek email KTA GATENSI')

  cekEnv()
  const smtpOke = await cekTransport()

  let kirimOke = true
  if (ke && smtpOke) {
    kirimOke = await kirimPercobaan(ke)
  } else if (ke) {
    console.log('\n▸ Kirim email percobaan — dilewati, koneksi SMTP-nya belum bener.')
    kirimOke = false
  }

  if (lihatUser) {
    await cekToken(lihatUser)
  }

  if (!ke) {
    console.log('')
    console.log('  Kirim email beneran buat ngetes tampilannya:')
    console.log('    npm run check-email -- --to=<email-tujuan>')
    console.log('  Lihat jejak token satu user:')
    console.log('    npm run check-email -- --user=<email-user>')
  }

  if (!smtpOke || !kirimOke) {
    process.exitCode = 1
  }

  console.log('')
}

main()
  .catch((error) => {
    console.error('\n✗ Gagal jalan:')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
