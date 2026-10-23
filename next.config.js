/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build mandiri buat self-host: output-nya bawa dependency sendiri,
  // nggak perlu bawa node_modules utuh ke server.
  output: 'standalone',
  // midtrans-client itu CJS dan di-require lazy dari lib/midtrans.ts. Tanpa ini
  // webpack ngubah `require('midtrans-client')` jadi module id internal yang
  // nggak ada di server — hasilnya 500 kosong tiap bikin Snap token.
  experimental: {
    serverComponentsExternalPackages: ['midtrans-client'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY,
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_ENVIRONMENT === 'production' ? 'true' : 'false',
  },
}

module.exports = nextConfig