/**
 * Hook resolve: ganti `lib/prisma` dengan double.
 *
 * Double-nya sengaja TIDAK nge-query apa pun. Yang dipakai test buat ngatur data
 * adalah `tests/unit/helpers/prisma-double.ts`, yang nge-import module ini dan
 * nge-isi tabelnya. Karena dua-duanya nunjuk ke file yang sama (bukan registry
 * terpisah), urutan import nggak masalah.
 */

// Double disimpan di sini, bukan di module lain yang di-import lazy: loader
// hook harus bisa balikin `namespace`-nya secara sinkron.
const TABEL = ['kTARequest', 'subklasifikasi', 'daerah', 'user', 'invoice', 'payment']

const takTerpakai = (nama) => async () => {
  throw new Error(
    `mock prisma: ${nama}() dipanggil, tapi test ini nggak nyiapin double-nya. ` +
      `Tambahin implementasinya di tests/unit/helpers/prisma-double.ts.`
  )
}

const double = {
  $connect: async () => {},
  $disconnect: async () => {},
  $transaction: async (arg) => (typeof arg === 'function' ? arg(double) : arg),
  $queryRaw: takTerpakai('$queryRaw'),
  $executeRaw: takTerpakai('$executeRaw'),
}

for (const nama of TABEL) {
  double[nama] = {
    findFirst: takTerpakai(`${nama}.findFirst`),
    findUnique: takTerpakai(`${nama}.findUnique`),
    findMany: takTerpakai(`${nama}.findMany`),
    create: takTerpakai(`${nama}.create`),
    update: takTerpakai(`${nama}.update`),
    updateMany: takTerpakai(`${nama}.updateMany`),
    count: takTerpakai(`${nama}.count`),
    delete: takTerpakai(`${nama}.delete`),
  }
}

function cocokPath(specifier, parentURL) {
  if (specifier === '@/lib/prisma') return true
  if (/(^|[\\/])lib[\\/]prisma(\.ts)?$/.test(specifier)) return true
  if (parentURL && specifier.startsWith('.') && /prisma$/.test(specifier)) return true
  return false
}

export async function resolve(specifier, context, nextResolve) {
  if (cocokPath(specifier, context.parentURL)) {
    return {
      url: 'kta-prisma-double:mock',
      format: 'module',
      shortCircuit: true,
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url === 'kta-prisma-double:mock') {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
const double = globalThis.__KTA_PRISMA_DOUBLE__
if (!double) {
  throw new Error(
    'mock prisma: double belum dipasang. Pastikan test meng-import ' +
      'tests/unit/helpers/prisma-double.ts sebelum modul yang diuji.'
  )
}
export const prisma = double
export default double
`,
    }
  }
  return nextLoad(url, context)
}
