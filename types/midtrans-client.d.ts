/**
 * `midtrans-client` nggak bawa file deklarasi tipe. Yang dipakai cuma class
 * `Snap`, dan bentuk method-nya sudah dideklarasikan sendiri di
 * `lib/midtrans.ts` (`SnapApi`) — jadi di sini cukup longgar.
 */
declare module 'midtrans-client' {
  const midtransClient: {
    Snap: new (options: {
      isProduction: boolean
      serverKey: string
      clientKey: string
    }) => unknown
  }
  export default midtransClient
}
