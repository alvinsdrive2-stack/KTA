# Payment Flow Update Plan - Jenjang-Based Pricing

## Current State Analysis

### Existing Payment Flow
1. **KTA List Page** (`/dashboard/kta/page.tsx`):
   - Multi-select checkboxes for KTAs
   - "Bayar" button → stores selected KTAs in localStorage
   - Navigates to `/dashboard/kta/payment`

2. **Payment Page** (`/dashboard/kta/payment/page.tsx`):
   - Gets selected KTAs from localStorage
   - Fetches **flat region price** from `/api/daerah/price`
   - Calculates: `selectedRequests.length × regionPrice`
   - Uploads payment proof
   - Creates bulk payment

### Problem
- Uses flat region pricing instead of jenjang-based pricing
- Doesn't account for daerah discount
- Doesn't show individual KTA prices
- Price calculation is too simple

---

## Implementation Plan

### Phase 1: Update Data Models & API

#### 1.1 Update KTA List API
**File**: `app/api/kta/list/route.ts`

Add jenjang and pricing info to the response:
```typescript
select: {
  id: true,
  idIzin: true,
  nama: true,
  nik: true,
  jabatanKerja: true,
  jenjang: true,  // ADD THIS
  status: true,
  hargaBase: true,  // ADD THIS
  diskonPersen: true,  // ADD THIS
  hargaFinal: true,  // ADD THIS
  daerah: {
    namaDaerah: true,
    kodeDaerah: true
  }
}
```

#### 1.2 Update Bulk Payment API
**File**: `app/api/kta/bulk-payment/route.ts`

Change price calculation from:
```typescript
// OLD - flat region price
const totalAmount = selectedRequests.length * regionPrice
```

To:
```typescript
// NEW - jenjang-based pricing with discount
let totalAmount = 0
const ktaPricing = []

for (const kta of selectedRequests) {
  const hargaBase = getHargaBaseByJenjang(kta.jenjang)
  const diskon = kta.daerah?.diskonPersen || 0
  const hargaFinal = hargaBase - (hargaBase * diskon / 100)

  totalAmount += hargaFinal

  ktaPricing.push({
    ktaId: kta.id,
    hargaBase,
    diskonPersen: diskon,
    hargaFinal
  })
}

// Save pricing to database
await prisma.payment.update({
  where: { id: paymentId },
  data: {
    amount: totalAmount,
    pricingBreakdown: ktaPricing  // ADD THIS FIELD
  }
})

// Update each KTA with pricing
await prisma.kTARequest.updateMany({
  where: { id: { in: requestIds } },
  data: {
    hargaBase,
    diskonPersen,
    hargaFinal
  }
})
```

---

### Phase 2: Update Frontend

#### 2.1 Update KTA List Interface
**File**: `app/dashboard/kta/page.tsx`

**Changes**:
1. Add price display to each KTA card/row
2. Show jenjang badge
3. Update checkbox selection to calculate total dynamically
4. Add floating "Bayar" bar with total calculation

```typescript
interface KTARequest {
  // ... existing
  jenjang: string  // ADD
  hargaBase: number  // ADD
  diskonPersen: number  // ADD
  hargaFinal: number  // ADD
}

// Calculate total when selection changes
useEffect(() => {
  const total = ktaRequests
    .filter(kta => selectedRequests.includes(kta.id))
    .reduce((sum, kta) => sum + kta.hargaFinal, 0)
  setTotalAmount(total)
}, [selectedRequests, ktaRequests])
```

**UI Add**:
```tsx
{/* Floating Payment Bar */}
{selectedRequests.length > 0 && (
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
    <div className="flex items-center justify-between max-w-7xl mx-auto">
      <div>
        <p className="text-sm text-slate-600">{selectedRequests.length} KTA dipilih</p>
        <p className="text-2xl font-bold text-slate-900">
          Rp {totalAmount.toLocaleString('id-ID')}
        </p>
      </div>
      <Button
        onClick={handleProceedToPayment}
        className="bg-blue-600 hover:bg-blue-700"
      >
        Lanjut Pembayaran
      </Button>
    </div>
  </div>
)}
```

#### 2.2 Update Payment Page
**File**: `app/dashboard/kta/payment/page.tsx`

**Changes**:
1. Remove region price fetch
2. Calculate prices from jenjang data
3. Show price breakdown table
4. Display discount info

```typescript
// Remove this
// const [regionPrice, setRegionPrice] = useState<number | null>(null)

// Add this
useEffect(() => {
  // Fetch daerah discount
  const fetchDaerahInfo = async () => {
    const response = await fetch('/api/daerah/my-diskon')
    const data = await response.json()
    setDiskonPersen(data.diskonPersen)
  }

  fetchDaerahInfo()
}, [])

// Calculate total from individual KTA prices
const calculateTotal = () => {
  return selectedRequests.reduce((sum, req) => {
    const hargaBase = getHargaBaseByJenjang(req.jenjang)
    const hargaFinal = hargaBase - (hargaBase * diskonPersen / 100)
    return sum + hargaFinal
  }, 0)
}

const getPriceBreakdown = () => {
  return selectedRequests.map(req => {
    const hargaBase = getHargaBaseByJenjang(req.jenjang)
    const hargaFinal = hargaBase - (hargaBase * diskonPersen / 100)
    return {
      ...req,
      hargaBase,
      diskon: diskonPersen,
      hargaFinal
    }
  })
}
```

**Price Breakdown Table**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Rincian Pembayaran</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      {getPriceBreakdown().map((item, idx) => (
        <div key={idx} className="flex justify-between text-sm p-2 bg-slate-50 rounded">
          <div>
            <p className="font-medium">{item.nama}</p>
            <p className="text-slate-500">Jenjang {item.jenjang}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500 line-through text-xs">
              Rp {item.hargaBase.toLocaleString('id-ID')}
            </p>
            <p className="font-semibold text-blue-600">
              Rp {item.hargaFinal.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      ))}

      <Separator />

      <div className="flex justify-between">
        <span className="font-medium">Total ({selectedRequests.length} KTA)</span>
        <span className="text-xl font-bold text-blue-600">
          Rp {calculateTotal().toLocaleString('id-ID')}
        </span>
      </div>

      {diskonPersen > 0 && (
        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
          💰 Hemat {diskonPersen}% dengan diskon daerah!
        </div>
      )}
    </div>
  </CardContent>
</Card>
```

---

### Phase 3: Database Schema Update

#### 3.1 Add Pricing Breakdown to Payment Model
**File**: `prisma/schema.prisma`

```prisma
model Payment {
  // ... existing

  // Add pricing breakdown field
  pricingBreakdown Json?  // Store array of { ktaId, hargaBase, diskonPersen, hargaFinal }

  // Keep amount field for total
  amount Int
}
```

#### 3.2 Run Migration
```bash
npx prisma db push
```

---

## Summary of Changes

### Files to Update

| File | Changes |
|------|---------|
| `app/api/kta/list/route.ts` | Add jenjang & pricing fields to response |
| `app/api/kta/bulk-payment/route.ts` | Update price calculation logic |
| `app/dashboard/kta/page.tsx` | Add price display & total calculation |
| `app/dashboard/kta/payment/page.tsx` | Replace region price with jenjang pricing breakdown |
| `prisma/schema.prisma` | Add `pricingBreakdown` to Payment model |

### Key Features

1. **Individual KTA Pricing**: Each KTA shows its price based on jenjang
2. **Dynamic Discount**: Daerah discount applied automatically
3. **Price Breakdown**: Clear table showing base price, discount, and final price
4. **Floating Total**: Real-time total calculation as KTAs are selected
5. **Bulk Payment**: Upload single proof for multiple KTAs with individual pricing

---

## Testing Checklist

- [ ] KTA list shows correct prices per jenjang
- [ ] Total calculation works when selecting multiple KTAs
- [ ] Payment page shows correct price breakdown
- [ ] Discount is applied correctly
- [ ] Bulk payment API saves individual pricing
- [ ] PUSAT can see price breakdown when verifying payments
