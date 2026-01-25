/**
 * Generate page title from path/route automatically
 */
export function generateTitleFromPath(path: string): string {
  // Remove query parameters and hash
  const cleanPath = path.split('?')[0].split('#')[0]

  // Remove leading/trailing slashes
  const segments = cleanPath.split('/').filter(Boolean)

  // Handle root
  if (segments.length === 0) {
    return 'Beranda'
  }

  // Handle dynamic routes [id], [nomorKTA], etc.
  const cleanSegments = segments
    .map(seg => {
      // Skip dynamic route segments
      if (seg.startsWith('[') && seg.endsWith(']')) {
        return null
      }
      return seg
    })
    .filter(Boolean)

  if (cleanSegments.length === 0) {
    return 'Detail'
  }

  // Convert kebab-case/camelCase to Title Case
  const titleMap: Record<string, string> = {
    'auth': 'Autentikasi',
    'login': 'Login',
    'register': 'Registrasi',
    'dashboard': 'Dashboard',
    'kta': 'KTA',
    'apply': 'Ajukan',
    'payment': 'Pembayaran',
    'payments': 'Pembayaran',
    'permohonan': 'Permohonan',
    'waiting-approval': 'Menunggu Persetujuan',
    'fetch-siki': 'Ambil Data SIKI',
    'print': 'Cetak',
    'invoice': 'Invoice',
    'invoices': 'Daftar Invoice',
    'upload': 'Upload',
    'create-manual': 'Buat Manual',
    'import-results': 'Hasil Import',
    'admin': 'Admin',
    'users': 'Pengguna',
    'data-manage': 'Kelola Data',
    'regenerate-qr': 'Regenerasi QR',
    'daerah-diskon': 'Diskon Daerah',
    'daerah': 'Daerah',
    'keuangan': 'Keuangan',
    'forbidden': 'Akses Ditolak',
    'verify': 'Verifikasi',
    'qr': 'QR Code',
    'kta-preview': 'Preview KTA',
    'waiting-approval': 'Menunggu Persetujuan',
  }

  const titles = cleanSegments.map(seg => {
    // Check if we have a mapping
    if (titleMap[seg]) {
      return titleMap[seg]
    }

    // Convert kebab-case to words and title case
    return seg
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  })

  // Reverse for more natural reading (Dashboard KTA instead of KTA Dashboard)
  return titles.reverse().join(' - ')
}

/**
 * Generate metadata object for a page
 */
export function generatePageMetadata(path: string, customTitle?: string) {
  return {
    title: customTitle || generateTitleFromPath(path),
  }
}
