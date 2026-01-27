import { prisma } from '../lib/prisma'

// Mapping data dari user (BPD -> Last KTA Number)
// Format: XX.YY.ZZZZZZ
// XX = kode daerah/provinsi
// YY = 01 (Ahli), 02 (Teknisi), 03 (Operator)
// ZZZZZZ = 6 digit sequence

interface KTASequence {
  kodePropinsi: string
  namaBPD: string
  lastKTAAhli: string      // Format: XX.01.ZZZZZZ
  lastKTATeknisi: string   // Format: XX.02.ZZZZZZ
  lastKTAOperator: string  // Format: XX.03.ZZZZZZ
}

const KTA_MAPPING: KTASequence[] = [
  { kodePropinsi: '11', namaBPD: 'ACEH', lastKTAAhli: '11.01.000042', lastKTATeknisi: '11.02.000136', lastKTAOperator: '11.03.000002' },
  { kodePropinsi: '13', namaBPD: 'SUMATERA BARAT', lastKTAAhli: '13.01.000030', lastKTATeknisi: '13.02.000127', lastKTAOperator: '13.03.000002' },
  { kodePropinsi: '15', namaBPD: 'JAMBI', lastKTAAhli: '15.01.000004', lastKTATeknisi: '15.02.000034', lastKTAOperator: '15.02.000000' }, // Operator di data tertulis 15.02.000000 (mungkin typo, should be 15.03)
  { kodePropinsi: '16', namaBPD: 'SUMATERA SELATAN', lastKTAAhli: '16.01.000134', lastKTATeknisi: '16.02.000630', lastKTAOperator: '16.03.000007' },
  { kodePropinsi: '18', namaBPD: 'LAMPUNG', lastKTAAhli: '18.01.000022', lastKTATeknisi: '18.02.000064', lastKTAOperator: '18.03.000001' },
  { kodePropinsi: '19', namaBPD: 'BANGKA BELITUNG', lastKTAAhli: '19.01.000065', lastKTATeknisi: '19.02.000149', lastKTAOperator: '19.03.000036' },
  { kodePropinsi: '21', namaBPD: 'KEPRI', lastKTAAhli: '21.01.000040', lastKTATeknisi: '21.02.000235', lastKTAOperator: '21.01.000000' }, // Operator di data tertulis 21.01.000000 (typo)
  { kodePropinsi: '31', namaBPD: 'DKI JAKARTA', lastKTAAhli: '31.01.000221', lastKTATeknisi: '31.02.000401', lastKTAOperator: '31.03.000012' },
  { kodePropinsi: '32', namaBPD: 'JAWA BARAT', lastKTAAhli: '32.01.000239', lastKTATeknisi: '32.02.000753', lastKTAOperator: '32.03.000063' },
  { kodePropinsi: '33', namaBPD: 'JAWA TENGAH', lastKTAAhli: '33.01.000398', lastKTATeknisi: '33.02.001287', lastKTAOperator: '33.03.000015' },
  { kodePropinsi: '35', namaBPD: 'JAWA TIMUR', lastKTAAhli: '35.01.000190', lastKTATeknisi: '35.02.001120', lastKTAOperator: '35.03.000029' },
  { kodePropinsi: '34', namaBPD: 'DI YOGYAKARTA', lastKTAAhli: '34.01.000033', lastKTATeknisi: '34.02.000183', lastKTAOperator: '34.03.000003' },
  { kodePropinsi: '36', namaBPD: 'BANTEN', lastKTAAhli: '36.01.000039', lastKTATeknisi: '36.02.000246', lastKTAOperator: '36.03.000012' },
  { kodePropinsi: '51', namaBPD: 'BALI', lastKTAAhli: '51.01.000128', lastKTATeknisi: '51.02.000539', lastKTAOperator: '51.03.000076' },
  { kodePropinsi: '52', namaBPD: 'NTB', lastKTAAhli: '52.01.000121', lastKTATeknisi: '52.02.000664', lastKTAOperator: '52.01.000000' }, // Operator di data tertulis 52.01.000000 (typo)
  { kodePropinsi: '53', namaBPD: 'NTT', lastKTAAhli: '53.01.000154', lastKTATeknisi: '53.02.000309', lastKTAOperator: '53.03.000005' },
  { kodePropinsi: '61', namaBPD: 'KALIMANTAN BARAT', lastKTAAhli: '61.01.000041', lastKTATeknisi: '61.02.000461', lastKTAOperator: '61.03.000015' },
  { kodePropinsi: '62', namaBPD: 'KALIMANTAN TENGAH', lastKTAAhli: '62.03.000000', lastKTATeknisi: '62.02.000008', lastKTAOperator: '62.03.000004' }, // Ahli di data tertulis 62.03.000000 (typo)
  { kodePropinsi: '63', namaBPD: 'KALIMANTAN SELATAN', lastKTAAhli: '63.01.000212', lastKTATeknisi: '63.02.000283', lastKTAOperator: '63.03.000001' },
  { kodePropinsi: '64', namaBPD: 'KALIMANTAN TIMUR', lastKTAAhli: '64.01.000185', lastKTATeknisi: '64.02.000966', lastKTAOperator: '64.02.000000' }, // Operator di data tertulis 64.02.000000 (typo)
  { kodePropinsi: '72', namaBPD: 'SULAWESI TENGAH', lastKTAAhli: '72.01.000028', lastKTATeknisi: '72.02.000091', lastKTAOperator: '72.02.000000' }, // Operator di data tertulis 72.02.000000 (typo)
  { kodePropinsi: '73', namaBPD: 'SULAWESI SELATAN', lastKTAAhli: '73.01.000172', lastKTATeknisi: '73.02.000369', lastKTAOperator: '73.02.000000' }, // Operator di data tertulis 73.02.000000 (typo)
  { kodePropinsi: '75', namaBPD: 'GORONTALO', lastKTAAhli: '75.01.000000', lastKTATeknisi: '75.02.000004', lastKTAOperator: '75.03.000000' },
  { kodePropinsi: '81', namaBPD: 'MALUKU', lastKTAAhli: '81.01.000000', lastKTATeknisi: '81.02.000000', lastKTAOperator: '81.03.000000' },
  { kodePropinsi: '91', namaBPD: 'PAPUA', lastKTAAhli: '91.01.000029', lastKTATeknisi: '91.02.000274', lastKTAOperator: '91.03.000000' },
  { kodePropinsi: '92', namaBPD: 'PAPUA BARAT', lastKTAAhli: '92.01.000023', lastKTATeknisi: '92.02.000248', lastKTAOperator: '92.03.000000' },
  { kodePropinsi: '00', namaBPD: 'PUSAT', lastKTAAhli: '99.01.001957', lastKTATeknisi: '99.02.002446', lastKTAOperator: '99.03.000329' }, // kodePropinsi for Pusat is '00', not '99'
]

// Extract sequence number from KTA number
// e.g., "11.01.000042" -> 42
function extractSequence(ktaNumber: string): number {
  const parts = ktaNumber.split('.')
  if (parts.length !== 3) {
    throw new Error(`Invalid KTA format: ${ktaNumber}`)
  }
  return parseInt(parts[2], 10)
}

async function main() {
  console.log('🚀 Starting KTA sequence setup...\n')

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const mapping of KTA_MAPPING) {
    try {
      // Find daerah by kode propinsi
      const daerah = await prisma.daerah.findFirst({
        where: { kodePropinsi: mapping.kodePropinsi }
      })

      if (!daerah) {
        console.log(`⚠️  SKIP: No daerah found for kode propinsi ${mapping.kodePropinsi} (${mapping.namaBPD})`)
        skipCount++
        continue
      }

      // Extract sequence numbers
      const lastSequenceAhli = extractSequence(mapping.lastKTAAhli)
      const lastSequenceTeknisi = extractSequence(mapping.lastKTATeknisi)
      const lastSequenceOperator = extractSequence(mapping.lastKTAOperator)

      // Update daerah
      await prisma.daerah.update({
        where: { id: daerah.id },
        data: {
          lastSequenceAhli,
          lastSequenceTeknisi,
          lastSequenceOperator,
        }
      })

      console.log(`✅ ${daerah.namaDaerah} (${daerah.kodeDaerah}):`)
      console.log(`   Ahli: ${lastSequenceAhli} | Teknisi: ${lastSequenceTeknisi} | Operator: ${lastSequenceOperator}`)
      successCount++

    } catch (error) {
      console.error(`❌ ERROR processing ${mapping.namaBPD}:`, error)
      errorCount++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 SUMMARY:')
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ⚠️  Skipped: ${skipCount}`)
  console.log(`   ❌ Errors:  ${errorCount}`)
  console.log('='.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
