/**
 * Loader hook buat `node --import tsx --test`.
 *
 * Tugasnya satu: setiap kali kode yang diuji ngimpor `@/lib/prisma`, balikin
 * module palsu. Jadi test unit nggak pernah nyentuh MySQL — `PrismaClient` tetap
 * di-instantiate (driver-nya tetap ke-load), tapi nggak ada query yang keluar
 * karena semua method tabel diganti double.
 *
 * Kenapa lewat loader, bukan `mock.module()`: `lib/prisma.ts` ada di repo dan
 * bukan punya QA buat diubah, dan `mock.module` di Node 22 masih
 * `--experimental-test-module-mocks` (butuh flag tambahan). Loader hook stabil
 * di Node 22 tanpa flag apa pun.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./prisma-hook.mjs', pathToFileURL(import.meta.filename))
