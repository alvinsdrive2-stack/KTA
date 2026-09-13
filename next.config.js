/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build mandiri buat self-host: output-nya bawa dependency sendiri,
  // nggak perlu bawa node_modules utuh ke server.
  output: 'standalone',
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