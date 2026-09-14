import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Kirim email lewat SMTP workspace.
 *
 * Domain gatensi.or.id pakai Google Workspace (MX = smtp.google.com), jadi
 * default-nya smtp.gmail.com:587 (STARTTLS). Semua bisa di-override lewat env
 * supaya pindah ke app password, SMTP relay, atau provider lain nggak perlu
 * ubah kode.
 *
 * Env yang dibaca:
 *   SMTP_HOST        default smtp.gmail.com
 *   SMTP_PORT        default 587
 *   SMTP_SECURE      'true' kalau port 465; default: port === 465
 *   SMTP_USER        akun SMTP, mis. noreply@gatensi.or.id
 *   SMTP_PASS        app password (bukan password login biasa)
 *   SMTP_FROM_NAME   nama pengirim, default "GATENSI"
 *   SMTP_FROM        alamat pengirim, default SMTP_USER
 */

const DEFAULT_HOST = 'smtp.gmail.com'
const DEFAULT_PORT = 587

let cachedTransporter: Transporter | null = null
let cachedKey = ''

function smtpConfig() {
  const host = process.env.SMTP_HOST || DEFAULT_HOST
  const port = parseInt(process.env.SMTP_PORT || String(DEFAULT_PORT), 10)
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465

  return { host, port, user, pass, secure }
}

/** Email dikonfigurasi belum? Kalau belum, route harus balas error yang jelas. */
export function isEmailConfigured(): boolean {
  const { user, pass } = smtpConfig()
  return Boolean(user && pass)
}

function getTransporter(): Transporter {
  const { host, port, user, pass, secure } = smtpConfig()
  const key = `${host}:${port}:${user}:${secure}`

  // Bikin ulang kalau env berubah (mis. habis ganti app password).
  if (cachedTransporter && cachedKey === key) return cachedTransporter

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Google suka nutup koneksi lambat; timeout eksplisit biar nggak ngegantung.
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  })
  cachedKey = key

  return cachedTransporter
}

export interface SendMailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendMail({ to, subject, html, text, replyTo }: SendMailInput) {
  if (!isEmailConfigured()) {
    throw new Error(
      'SMTP belum dikonfigurasi. Isi SMTP_USER dan SMTP_PASS di .env server.'
    )
  }

  const { user } = smtpConfig()
  const fromAddress = process.env.SMTP_FROM || user
  const fromName = process.env.SMTP_FROM_NAME || 'GATENSI'

  const info = await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    replyTo,
  })

  return info
}

/** Cek koneksi + kredensial SMTP tanpa kirim email. Dipakai buat setup. */
export async function verifyEmailTransport(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getTransporter().verify()
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
}

/**
 * Link absolut ke aplikasi. NEXTAUTH_URL dipakai karena itu yang sudah ada di
 * server — tapi isinya cuma hostname (`kta.Gatensi.or.id`, tanpa protokol),
 * jadi protokolnya ditambahin di sini. Link email wajib absolut.
 */
export function appUrl(path = ''): string {
  let base = (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).trim().replace(/\/$/, '')

  if (!/^https?:\/\//i.test(base)) {
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(base)
    base = `${isLocal ? 'http' : 'https'}://${base}`
  }

  // Hostname diturunin ke huruf kecil. DNS sendiri nggak peduli, tapi link yang
  // kekirim ke email sebaiknya konsisten — NEXTAUTH_URL di server isinya
  // "kta.Gatensi.or.id". Cuma host yang diubah, path-nya dibiarin.
  try {
    const parsed = new URL(base)
    base = `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}`
  } catch {
    // Base nggak bisa di-parse — biarin apa adanya, jangan bikin link gagal total.
  }

  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function emailShell(title: string, bodyHtml: string): string {
  // Warna & font ngikutin brand project: --Gatensi-blue #1E3A8A (brand-blue-900),
  // --Gatensi-red #E31937, body font Inter (sama kayak app/layout.tsx).
  return `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#1E3A8A;padding:22px 28px;">
                <span style="color:#ffffff;font-size:16px;font-weight:600;letter-spacing:0.2px;">Gabungan Ahli Teknik Nasional Indonesia</span>
              </td>
            </tr>
            <tr>
              <td style="height:3px;line-height:3px;font-size:0;background:#E31937;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:19px;font-weight:600;color:#0f172a;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <span style="font-size:12px;color:#64748b;">Email otomatis dari sistem KTA GATENSI. Jangan balas email ini.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buttonHtml(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">${label}</a>`
}

/** "60 menit" / "7 hari" — buat teks masa berlaku link. */
function humanDuration(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440)
    return `${days} hari`
  }
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60)
    return `${hours} jam`
  }
  return `${minutes} menit`
}

/**
 * Akun baru — kirim LINK buat bikin password sendiri.
 *
 * Sengaja nggak ada password di dalam email: password yang beredar di inbox
 * itu password yang bocor kalau inbox-nya kebuka. User yang nentuin sendiri.
 */
export function renderSetPasswordEmail(input: {
  name: string
  email: string
  setPasswordUrl: string
  expiresMinutes: number
}) {
  const title = 'Aktifkan akun KTA GATENSI Anda'
  const body = `
    <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.6;">
      Halo <strong>${input.name}</strong>, akun Anda di sistem KTA GATENSI sudah dibuat
      oleh administrator. Langkah terakhir: buat password Anda sendiri.
    </p>
    <p style="margin:0 0 18px;font-size:14px;">
      ${buttonHtml(input.setPasswordUrl, 'Buat Password Saya')}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 18px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#64748b;width:110px;">Email login</td>
        <td style="padding:12px 16px;font-size:13px;color:#0f172a;font-weight:600;">${input.email}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">Password</td>
        <td style="padding:12px 16px;font-size:13px;color:#0f172a;border-top:1px solid #e2e8f0;">Belum dibuat — klik tombol di atas</td>
      </tr>
    </table>
    <p style="margin:0 0 14px;font-size:13px;color:#64748b;line-height:1.6;">
      Link ini berlaku ${humanDuration(input.expiresMinutes)} dan cuma bisa dipakai sekali.
      Kalau sudah kedaluwarsa, minta administrator mengirim ulang atau pakai menu
      &ldquo;Lupa password?&rdquo; di halaman login.
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;line-height:1.6;">
      Kalau tombolnya tidak bisa diklik, buka link berikut:<br />${input.setPasswordUrl}
    </p>
  `
  return { subject: 'Aktifkan akun KTA GATENSI Anda', html: emailShell(title, body) }
}

/** Notifikasi password direset admin. */
export function renderPasswordResetByAdminEmail(input: {
  name: string
  email: string
  password: string
}) {
  const loginUrl = appUrl('/auth/login')
  const title = 'Password akun KTA GATENSI Anda direset'
  const body = `
    <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.6;">
      Halo <strong>${input.name}</strong>, password akun Anda baru saja direset oleh administrator.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 18px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#64748b;width:110px;">Email</td>
        <td style="padding:12px 16px;font-size:13px;color:#0f172a;font-weight:600;">${input.email}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">Password baru</td>
        <td style="padding:12px 16px;font-size:13px;color:#0f172a;font-weight:600;border-top:1px solid #e2e8f0;">${input.password}</td>
      </tr>
    </table>
    <p style="margin:0 0 18px;font-size:14px;color:#334155;line-height:1.6;">
      Anda wajib mengganti password ini saat login berikutnya.
    </p>
    <p style="margin:0;font-size:14px;">
      ${buttonHtml(loginUrl, 'Masuk ke Dashboard')}
    </p>
  `
  return { subject: 'Password KTA GATENSI Anda direset', html: emailShell(title, body) }
}

/** Email lupa password — berisi link reset. */
export function renderPasswordResetEmail(input: {
  name: string
  resetUrl: string
  expiresMinutes: number
}) {
  const title = 'Reset password KTA GATENSI'
  const body = `
    <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.6;">
      Halo <strong>${input.name}</strong>, kami menerima permintaan reset password untuk akun ini.
    </p>
    <p style="margin:0 0 18px;font-size:14px;">
      ${buttonHtml(input.resetUrl, 'Ganti Password Saya')}
    </p>
    <p style="margin:0 0 14px;font-size:13px;color:#64748b;line-height:1.6;">
      Link ini berlaku ${input.expiresMinutes} menit dan cuma bisa dipakai sekali.
      Kalau Anda tidak meminta reset, abaikan saja email ini — password Anda tidak berubah.
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;line-height:1.6;">
      Kalau tombolnya tidak bisa diklik, buka link berikut:<br />${input.resetUrl}
    </p>
  `
  return { subject: 'Reset password KTA GATENSI', html: emailShell(title, body) }
}
