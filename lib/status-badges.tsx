import { Clock, CheckCircle, XCircle } from 'lucide-react'

/**
 * Badge status buat tabel pembayaran & KTA — satu sumber.
 *
 * Sebelumnya `getStatusBadge` ditulis ulang di 8 halaman dengan 6 versi berbeda,
 * jadi status yang sama bisa tampil label/warna beda tergantung halaman.
 * Dua peta di bawah ini diambil dari pasangan yang isinya sudah identik
 * (`payments/{daerah,pusat}/invoices` dan `payments/{daerah,pusat}/page`),
 * jadi nol perubahan tampilan.
 */

export interface StatusBadge {
  label: string
  className: string
  icon?: React.ReactNode
}

/** Status pembayaran (tabel invoice). */
const PAYMENT_STATUS_BADGES: Record<string, StatusBadge> = {
  PENDING: {
    label: 'Menunggu Pembayaran',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Clock className="h-3 w-3" />,
  },
  PAID: {
    label: 'Menunggu Verifikasi',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Clock className="h-3 w-3" />,
  },
  VERIFIED: {
    label: 'Terverifikasi',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  REJECTED: {
    label: 'Ditolak',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="h-3 w-3" />,
  },
}

/** Status siklus hidup KTA (tabel permohonan). */
const KTA_STATUS_BADGES: Record<string, StatusBadge> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-800 border-gray-200' },
  FETCHED_FROM_SIKI: { label: 'Diambil dari SIKI', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  EDITED: { label: 'Edited', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  WAITING_PAYMENT: { label: 'Menunggu Pembayaran', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  UPGRADE_PENDING: { label: 'Upgrade - Menunggu Pembayaran', className: 'bg-purple-100 text-purple-800 border-purple-200' },
}

export function getPaymentStatusBadge(status: string): StatusBadge {
  return (
    PAYMENT_STATUS_BADGES[status] || {
      label: status,
      className: 'bg-gray-100 text-gray-800',
      icon: null,
    }
  )
}

export function getKtaStatusBadge(status: string): StatusBadge {
  return (
    KTA_STATUS_BADGES[status] || {
      label: status,
      className: 'bg-gray-100 text-gray-800',
    }
  )
}
