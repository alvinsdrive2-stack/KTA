# KTA Management System

Sistem manajemen Kartu Tanda Anggota (KTA) berbasis Next.js 16 dengan integrasi SIKI PU

## Fitur

- ✅ **Integrasi SIKI API** - Fetch data otomatis dari SIKI PU
- ✅ **Multi Role** - Daerah (admin lokal) & Pusat (admin central)
- ✅ **QR Code Verification** - Generate QR untuk verifikasi KTA
- ✅ **Payment Gateway** - Upload bukti bayar & konfirmasi
- ✅ **PDF Generator** - Generate kartu KTA dalam format PDF
- ✅ **Professional UI** - Construction theme dengan shadcn/ui
- ✅ **TypeScript** - Full type safety
- ✅ **Responsive Design** - Mobile friendly

## Tech Stack

- **Framework**: Next.js 16 App Router
- **Language**: TypeScript
- **Database**: PostgreSQL dengan Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: NextAuth.js
- **Form Handling**: React Hook Form + Zod
- **PDF Generation**: PDF-lib
- **QR Code**: qrcode library

## Cara Install

1. **Clone repository**
```bash
git clone <repository-url>
cd kta-management
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
DATABASE_URL="postgresql://username:password@host:5432/database"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
SIKI_API_TOKEN="f3332337ac671c33262198340c2f7b579f7843775ecc425107f086956cbb2b1a9e96b0cc6f643d24"
REKENING_TUJUAN="1234567890 - Bank Mandiri - a.n. ASOSIASI TENAGA KONSTRUKSI INDONESIA"
```

4. **Setup database**
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

5. **Run development server**
```bash
npm run dev
```

Buka http://localhost:3000

## Struktur Project

```
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── verify/            # Public verification page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── auth/              # Auth components
│   ├── dashboard/         # Dashboard components
│   ├── forms/             # Form components
│   └── ui/                # shadcn/ui components
├── lib/                   # Utility functions
│   ├── auth.ts           # NextAuth config
│   ├── prisma.ts         # Prisma client
│   ├── siki-api.ts       # SIKI API client
│   ├── qr-code.ts        # QR generator
│   ├── pdf-generator.ts  # PDF generator
│   └── validations.ts    # Zod schemas
├── prisma/               # Database schema & migrations
│   ├── schema.prisma     # Prisma schema
│   └── seed.ts           # Seed script
└── public/               # Static assets
```

## API Endpoints

### KTA Operations
- `POST /api/kta/fetch-siki` - Fetch data dari SIKI
- `POST /api/kta/create-or-update` - Create/update KTA
- `POST /api/kta/submit-waiting-list` - Submit ke waiting list

### Payment
- `POST /api/payment/upload` - Upload bukti bayar
- `POST /api/payment/confirm` - Konfirmasi pembayaran (pusat)

### Pusat Approval
- `POST /api/pusat/approve` - Approve/reject KTA
- `GET /api/pusat/approve` - Get waiting list

### QR & Verification
- `GET /api/qr/[id]` - Get QR verification data
- `/verify/[id_izin]` - Public verification page

## Default Users

Setelah seeding, Anda bisa login dengan:

1. **Admin Pusat**
   - Email: `admin@pusat.com`
   - Password: `password123`

2. **Admin Jakarta**
   - Email: `jakarta@daerah.com`
   - Password: `password123`

3. **Admin Surabaya**
   - Email: `surabaya@daerah.com`
   - Password: `password123`

## Flow KTA

1. **Daerah** input ID Izin
2. System fetch data dari SIKI API
3. Daerah edit data & upload dokumen (KTP, Foto)
4. Submit ke waiting list
5. Upload bukti pembayaran
6. **Pusat** review & approve
7. Generate QR Code & PDF KTA
8. Print & distribute

## Status Flow

```
DRAFT → FETCHED_FROM_SIKI → EDITED → WAITING_PAYMENT → READY_FOR_PUSAT → APPROVED_BY_PUSAT → READY_TO_PRINT → PRINTED
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Base URL for NextAuth |
| `NEXTAUTH_SECRET` | Secret for JWT signing |
| `SIKI_API_TOKEN` | API token untuk SIKI PU |
| `REKENING_TUJUAN` | Info rekening pembayaran |

## Build & Deploy

```bash
# Build untuk production
npm run build

# Start production server
npm start
```

## Contributing

1. Fork project
2. Create feature branch
3. Commit changes
4. Push ke branch
5. Create Pull Request

## License

MIT License - see LICENSE file

## Support

Untuk support, email ke support@atk-indonesia.org