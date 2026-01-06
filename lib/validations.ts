import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
})

export const ktaRequestSchema = z.object({
  idIzin: z.string().min(5, "ID Izin minimal 5 karakter"),
  nik: z.string().min(16, "NIK harus 16 digit").max(16, "NIK harus 16 digit"),
  nama: z.string().min(3, "Nama minimal 3 karakter"),
  jabatanKerja: z.string().min(3, "Jabatan kerja minimal 3 karakter"),
  subklasifikasi: z.string().min(3, "Subklasifikasi minimal 3 karakter"),
  jenjang: z.string().min(2, "Jenjang minimal 2 karakter"),
  noTelp: z.string().min(10, "Nomor telepon minimal 10 digit"),
  email: z.string().email("Email tidak valid"),
  alamat: z.string().min(10, "Alamat minimal 10 karakter"),
  tanggalDaftar: z.string().min(1, "Tanggal daftar harus diisi"),
})

export const ktaEditSchema = ktaRequestSchema.partial()

export const documentUploadSchema = z.object({
  jenis: z.enum(["KTP", "FOTO", "SERTIFIKAT", "SURAT_KETERANGAN"]),
  link: z.string().url("Link tidak valid"),
})

export const paymentSchema = z.object({
  invoiceNumber: z.string().min(1, "Nomor invoice harus diisi"),
  rekeningTujuan: z.string().min(10, "Nomor rekening minimal 10 digit"),
  jumlah: z.number().min(10000, "Jumlah minimal Rp 10.000"),
  buktiBayarLink: z.string().url("Link bukti bayar tidak valid").optional(),
})

export const approvalSchema = z.object({
  ktaRequestId: z.string().min(1, "ID KTA Request harus diisi"),
  status: z.enum(["APPROVED", "REJECTED", "REVISION"]),
  catatan: z.string().optional(),
})

export const daerahSchema = z.object({
  namaDaerah: z.string().min(3, "Nama daerah minimal 3 karakter"),
  kodeDaerah: z.string().min(2, "Kode daerah minimal 2 karakter"),
  alamat: z.string().optional(),
  telepon: z.string().optional(),
  email: z.string().email("Email tidak valid").optional(),
})

export const regionPriceSchema = z.object({
  daerahId: z.string().min(1, "ID Daerah harus diisi"),
  hargaKta: z.number().min(0, "Harga harus non-negatif"),
  tahun: z.number().min(2024, "Tahun minimal 2024").max(2050, "Tahun maksimal 2050"),
})

export const userSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  role: z.enum(["DAERAH", "PUSAT", "ADMIN"]),
  daerahId: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const userEditSchema = userSchema.partial().omit({ email: true })

export const qrVerifySchema = z.object({
  idIzin: z.string().min(5, "ID Izin minimal 5 karakter"),
})

export type LoginInput = z.infer<typeof loginSchema>
export type KTARequestInput = z.infer<typeof ktaRequestSchema>
export type KTAEditInput = z.infer<typeof ktaEditSchema>
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type ApprovalInput = z.infer<typeof approvalSchema>
export type DaerahInput = z.infer<typeof daerahSchema>
export type RegionPriceInput = z.infer<typeof regionPriceSchema>
export type UserInput = z.infer<typeof userSchema>
export type UserEditInput = z.infer<typeof userEditSchema>
export type QRVerifyInput = z.infer<typeof qrVerifySchema>