# Implementation Plan - Harga Berdasarkan Jenjang + Diskon Daerah

## 📋 Overview
Mengubah sistem harga KTA dari flat rate per daerah menjadi harga berdasarkan jenjang dengan diskon daerah.

## 🎯 Requirements

### Harga Base (Fixed)
- **Jenjang 1-6**: Rp. 100.000
- **Jenjang 7-9**: Rp. 300.000

### Diskon Daerah
- Hanya **PUSAT/ADMIN** yang bisa set diskon per daerah
- Diskon dalam bentuk persen (0-100%)
- Diskon diapply saat apply KTA

### Perhitungan Harga Final
```
Harga Final = Harga Base - (Diskon% × Harga Base)

Contoh:
- Jenjang 3, Diskon 0%   = Rp. 100.000
- Jenjang 3, Diskon 50%  = Rp. 50.000
- Jenjang 8, Diskon 0%   = Rp. 300.000
- Jenjang 8, Diskon 50%  = Rp. 150.000
```

## 🗄️ Database Schema Changes

### 1. Update `Daerah` Model
```prisma
model Daerah {
  id            String  @id @default(cuid())
  namaDaerah    String
  kodeDaerah    String  @unique
  kodePropinsi  String?
  alamat        String?
  telepon       String?
  email         String?
  isActive      Boolean @default(true)
  diskonPersen  Int     @default(0)  // NEW: 0-100

  users         User[]
  ktaRequests   KTARequest[]
  // regionPrices  RegionPrice[]  // REMOVE: no longer needed
}

// RegionPrice model can be DEPRECATED/REMOVED
```

### 2. Update `KTARequest` Model
```prisma
model KTARequest {
  id              String      @id @default(cuid())
  // ... existing fields

  jenjang         String
  hargaBase       Int         // NEW: 100.000 or 300.000
  diskonPersen    Int         // NEW: copied from daerah
  hargaFinal      Int         // NEW: after discount

  // hargaRegion    Int         // DEPRECATED: use hargaFinal instead
}
```

### 3. Migration SQL
```sql
-- Add diskonPersen to Daerah table
ALTER TABLE "Daerah" ADD COLUMN "diskonPersen" INTEGER NOT NULL DEFAULT 0;

-- Add pricing fields to KTARequest
ALTER TABLE "KTARequest" ADD COLUMN "hargaBase" INTEGER;
ALTER TABLE "KTARequest" ADD COLUMN "diskonPersen" INTEGER;
ALTER TABLE "KTARequest" ADD COLUMN "hargaFinal" INTEGER;

-- Migrate existing data
UPDATE "KTARequest"
SET
  "hargaBase" = CASE
    WHEN CAST("jenjang" AS INTEGER) >= 7 THEN 300000
    ELSE 100000
  END,
  "diskonPersen" = 0,
  "hargaFinal" = "hargaRegion";

-- Optionally drop RegionPrice table after migration
-- DROP TABLE "RegionPrice";
```

## 🔧 API Changes

### 1. Create `/api/daerah/with-diskon`
```typescript
// GET /api/daerah/with-diskon
// Returns daerah data with diskon for all daerah (for admin)

// Response:
{
  success: true,
  data: [
    {
      id: "xxx",
      namaDaerah: "DKI Jakarta",
      kodeDaerah: "31",
      diskonPersen: 50  // Admin can edit this
    },
    ...
  ]
}
```

### 2. Update `/api/daerah/price` (or replace with `/api/daerah/my-diskon`)
```typescript
// GET /api/daerah/my-diskon
// Returns current user's daerah diskon

// Response:
{
  success: true,
  diskonPersen: 30  // Based on user's daerah
}
```

### 3. Create `/api/admin/daerah/[id]/diskon`
```typescript
// PATCH /api/admin/daerah/[id]/diskon
// Update diskon for a daerah (PUSAT/ADMIN only)

// Request:
{
  diskonPersen: 50  // 0-100
}

// Response:
{
  success: true,
  data: {
    id: "xxx",
    namaDaerah: "DKI Jakarta",
    diskonPersen: 50
  }
}
```

### 4. Update `/api/kta/create`
```typescript
// Calculate and save pricing data

// In the route:
const jenjang = body.jenjang
const daerah = await prisma.daerah.findUnique({ where: { id: daerahId } })

// Calculate pricing
const hargaBase = getPricingByJenjang(jenjang)  // 100k or 300k
const diskonPersen = daerah?.diskonPersen || 0
const hargaFinal = hargaBase - (hargaBase * diskonPersen / 100)

// Save to KTARequest
await prisma.kTARequest.create({
  data: {
    ...,
    jenjang,
    hargaBase,
    diskonPersen,
    hargaFinal
  }
})
```

## 🎨 Frontend Changes

### 1. Update `app/dashboard/kta/apply/page.tsx`

#### Add State:
```typescript
const [jenjang, setJenjang] = useState('')
const [hargaBase, setHargaBase] = useState(0)
const [diskonPersen, setDiskonPersen] = useState(0)
const [hargaFinal, setHargaFinal] = useState(0)
const [isPusatOrAdmin, setIsPusatOrAdmin] = useState(false)
```

#### Add Effect to Calculate Price:
```typescript
useEffect(() => {
  if (!jenjang) return

  // Calculate base price
  const j = parseInt(jenjang)
  const base = j >= 7 ? 300000 : 100000
  setHargaBase(base)

  // Fetch daerah diskon
  fetch('/api/daerah/my-diskon')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setDiskonPersen(data.diskonPersen)
        const final = base - (base * data.diskonPersen / 100)
        setHargaFinal(final)
      }
    })
}, [jenjang])
```

#### Update Payment Card UI:
```tsx
<Card className="card-3d animate-slide-up-stagger stagger-4">
  <CardHeader className="border-b border-slate-200 bg-slate-50/50">
    <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
      <CreditCard className="h-5 w-5 text-slate-700" />
      Pembayaran
    </CardTitle>
  </CardHeader>
  <CardContent className="pt-5">
    <div className="space-y-4">
      {/* Jenjang Selector */}
      <div>
        <Label className="text-sm font-medium text-slate-700">Jenjang</Label>
        <Select value={jenjang} onValueChange={setJenjang}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Pilih jenjang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 - Terampil</SelectItem>
            <SelectItem value="2">2 - Mahir</SelectItem>
            <SelectItem value="3">3 - Penyelia</SelectItem>
            <SelectItem value="4">4 - Ahli Muda</SelectItem>
            <SelectItem value="5">5 - Ahli Madya</SelectItem>
            <SelectItem value="6">6 - Ahli Utama</SelectItem>
            <SelectItem value="7">7 -</SelectItem>
            <SelectItem value="8">8 -</SelectItem>
            <SelectItem value="9">9 -</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Price Breakdown */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Harga Base</span>
          <span className="font-medium">Rp {hargaBase.toLocaleString('id-ID')}</span>
        </div>

        <div className="flex justify-between text-sm items-center">
          <span className="text-slate-600">Diskon</span>
          {isPusatOrAdmin ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={diskonPersen}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  setDiskonPersen(val)
                  setHargaFinal(hargaBase - (hargaBase * val / 100))
                }}
                className="w-20 h-8 text-right"
              />
              <span className="text-slate-600">%</span>
            </div>
          ) : (
            <span className="font-medium text-slate-700">{diskonPersen}%</span>
          )}
        </div>

        <Separator />

        <div className="flex justify-between">
          <span className="font-semibold text-slate-900">Total Bayar</span>
          <span className="text-xl font-bold text-gatensi-blue">
            Rp {hargaFinal.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Info */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          Harga berdasarkan jenjang: 1-6 = Rp 100.000, 7-9 = Rp 300.000
        </AlertDescription>
      </Alert>
    </div>
  </CardContent>
</Card>
```

### 2. Create Admin Daerah Diskon Management Page

#### File: `app/dashboard/admin/daerah-diskon/page.tsx`
```tsx
// Table of all daerah with editable diskon
// Columns: Daerah, Kode, Diskon (input), Aksi (Save)
// Only accessible by PUSAT/ADMIN
```

## 📝 Implementation Checklist

### Phase 1: Database
- [ ] Add `diskonPersen` field to `Daerah` model
- [ ] Add `hargaBase`, `diskonPersen`, `hargaFinal` to `KTARequest` model
- [ ] Create migration SQL
- [ ] Run migration
- [ ] Migrate existing data
- [ ] (Optional) Remove RegionPrice table

### Phase 2: Backend API
- [ ] Create `/api/daerah/my-diskon` route
- [ ] Create `/api/admin/daerah/[id]/diskon` route
- [ ] Update `/api/kta/create` to use jenjang pricing
- [ ] Add validation for diskon (0-100)

### Phase 3: Frontend
- [ ] Update apply page with jenjang selector
- [ ] Add price calculation logic
- [ ] Update payment card UI
- [ ] Create admin daerah diskon management page
- [ ] Add loading states and error handling

### Phase 4: Testing
- [ ] Test pricing calculation for jenjang 1-6
- [ ] Test pricing calculation for jenjang 7-9
- [ ] Test discount application
- [ ] Test admin diskon update
- [ ] Test DAERAH user (diskon read-only)
- [ ] Test PUSAT/ADMIN user (diskon editable)

## 🧪 Test Cases

### Test Case 1: Jenjang 1-6
- Jenjang: 3
- Diskon: 0%
- Expected: Base = 100.000, Final = 100.000

### Test Case 2: Jenjang 7-9
- Jenjang: 8
- Diskon: 0%
- Expected: Base = 300.000, Final = 300.000

### Test Case 3: With Discount
- Jenjang: 5
- Diskon: 50%
- Expected: Base = 100.000, Final = 50.000

### Test Case 4: Admin Edit Discount
- Login as PUSAT/ADMIN
- Edit DKI Jakarta discount to 75%
- Create KTA for DKI Jakarta user
- Expected: Final price reflects 75% discount

## 🚀 Deployment Notes

1. Backup database before migration
2. Test migration on staging first
3. Deploy backend changes first
4. Deploy frontend changes
5. Monitor for any pricing issues

## 📚 Related Files

- `prisma/schema.prisma` - Database models
- `app/api/daerah/price/route.ts` - Current pricing API (to be deprecated)
- `app/api/kta/create/route.ts` - KTA creation logic
- `app/dashboard/kta/apply/page.tsx` - Apply KTA page
