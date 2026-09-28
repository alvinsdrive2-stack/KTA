// Flat config ESLint 9 — dijalankan langsung lewat `npm run lint` (`eslint .`).
// Bukan lewat `next lint`: Next 14 belum kenal flat config, padahal di repo ini
// terpasang ESLint 9 + eslint-config-next@16 yang bentuknya flat. `next lint`
// cuma bakal nanya preset interaktif dan nggak pernah benar-benar nge-lint.
//
// Preset inti diambil dari eslint-config-next@16: core-web-vitals (aturan Next
// + react + import + jsx-a11y) dan typescript (aturan @typescript-eslint).
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'screenshots/**',
      'storage/**',
      'supabase-dump/**',
      'generated/**',
      'public/**',
    ],
  },
  ...nextVitals,
  ...nextTs,
]
