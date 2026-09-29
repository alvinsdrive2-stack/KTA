/**
 * `pdfjs-dist/legacy/build/pdf.worker.mjs` nggak punya file deklarasi sendiri —
 * `types` di package.json-nya cuma nunjuk ke build utama (`pdf.d.mts`), yang
 * nggak nge-export `WorkerMessageHandler`.
 *
 * Padahal runtime-nya nge-export itu, dan kita butuh buat ditempel ke
 * `globalThis.pdfjsWorker` (lihat `lib/pdf-to-image.ts`). Jadi tipenya dideklarin
 * manual di sini — sengaja longgar (`unknown`) karena yang dipakai pdfjs cuma
 * dicek ada atau nggak, terus `WorkerMessageHandler.setup()` dipanggil internal
 * dari sisi pdfjs sendiri.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown
}
