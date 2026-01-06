export interface ProvinceMapping {
  name: string
  kodePropinsi: string
}

export const provinceMappings: ProvinceMapping[] = [
  { name: "Nasional", kodePropinsi: "00" },
  { name: "Aceh", kodePropinsi: "11" },
  { name: "Sumatera Utara", kodePropinsi: "12" },
  { name: "Sumatera Barat", kodePropinsi: "13" },
  { name: "Riau", kodePropinsi: "14" },
  { name: "Kepulauan Riau", kodePropinsi: "21" },
  { name: "Jambi", kodePropinsi: "15" },
  { name: "Bangka Belitung", kodePropinsi: "19" },
  { name: "Sumatera Selatan", kodePropinsi: "16" },
  { name: "Bengkulu", kodePropinsi: "17" },
  { name: "Lampung", kodePropinsi: "18" },
  { name: "DKI Jakarta", kodePropinsi: "31" },
  { name: "Jawa Barat", kodePropinsi: "32" },
  { name: "Banten", kodePropinsi: "36" },
  { name: "Jawa Tengah", kodePropinsi: "33" },
  { name: "DI Yogyakarta", kodePropinsi: "34" },
  { name: "Jawa Timur", kodePropinsi: "35" },
  { name: "Bali", kodePropinsi: "51" },
  { name: "Nusa Tenggara Barat", kodePropinsi: "52" },
  { name: "Nusa Tenggara Timur", kodePropinsi: "53" },
  { name: "Kalimantan Barat", kodePropinsi: "61" },
  { name: "Kalimantan Tengah", kodePropinsi: "62" },
  { name: "Kalimantan Selatan", kodePropinsi: "63" },
  { name: "Kalimantan Timur", kodePropinsi: "64" },
  { name: "Kalimantan Utara", kodePropinsi: "65" },
  { name: "Sulawesi Utara", kodePropinsi: "71" },
  { name: "Gorontalo", kodePropinsi: "75" },
  { name: "Sulawesi Tengah", kodePropinsi: "72" },
  { name: "Sulawesi Barat", kodePropinsi: "76" },
  { name: "Sulawesi Selatan", kodePropinsi: "73" },
  { name: "Sulawesi Tenggara", kodePropinsi: "74" },
  { name: "Maluku", kodePropinsi: "81" },
  { name: "Maluku Utara", kodePropinsi: "82" },
  { name: "Papua Barat", kodePropinsi: "92" },
  { name: "Papua", kodePropinsi: "91" },
  { name: "Papua Barat Daya", kodePropinsi: "96" },
  { name: "Papua Selatan", kodePropinsi: "93" },
  { name: "Papua Tengah", kodePropinsi: "94" },
  { name: "Papua Pegunungan", kodePropinsi: "95" },
  { name: "Luar Negeri", kodePropinsi: "99" }
]

// Common province variations and abbreviations
const provinceVariations: { [key: string]: string } = {
  // Variations
  "dki": "DKI Jakarta",
  "diy": "DI Yogyakarta",
  "jateng": "Jawa Tengah",
  "jatim": "Jawa Timur",
  "jabar": "Jawa Barat",
  "kalbar": "Kalimantan Barat",
  "kalteng": "Kalimantan Tengah",
  "kalsel": "Kalimantan Selatan",
  "kaltim": "Kalimantan Timur",
  "kalut": "Kalimantan Utara",
  "sulut": "Sulawesi Utara",
  "sulteng": "Sulawesi Tengah",
  "sulsel": "Sulawesi Selatan",
  "sultenggara": "Sulawesi Tenggara",
  "sulbar": "Sulawesi Barat",
  "ntb": "Nusa Tenggara Barat",
  "ntt": "Nusa Tenggara Timur",
  "babel": "Bangka Belitung",
  "kepri": "Kepulauan Riau",
  "papua barat daya": "Papua Barat Daya",
  "papua selatan": "Papua Selatan",
  "papua tengah": "Papua Tengah",
  "papua pegunungan": "Papua Pegunungan",

  // Common misspellings
  "jakarta": "DKI Jakarta",
  "yogyakarta": "DI Yogyakarta",
  "jogjakarta": "DI Yogyakarta",
  "west java": "Jawa Barat",
  "central java": "Jawa Tengah",
  "east java": "Jawa Timur"
}

export function extractProvinceFromAddress(address: string): string | null {
  if (!address) return null

  const addressLower = address.toLowerCase()

  // Direct matching
  for (const province of provinceMappings) {
    if (addressLower.includes(province.name.toLowerCase())) {
      return province.kodePropinsi
    }
  }

  // Check variations
  for (const [variation, standard] of Object.entries(provinceVariations)) {
    if (addressLower.includes(variation.toLowerCase())) {
      const found = provinceMappings.find(p => p.name === standard)
      if (found) return found.kodePropinsi
    }
  }

  // Check for province indicators in Indonesian addresses
  const provincePatterns = [
    /prov\.*\s*([a-z\s]+)/i,
    /propinsi\s*([a-z\s]+)/i
  ]

  for (const pattern of provincePatterns) {
    const match = address.match(pattern)
    if (match && match[1]) {
      const provinceName = match[1].trim()
      const found = provinceMappings.find(p =>
        p.name.toLowerCase().includes(provinceName.toLowerCase())
      )
      if (found) return found.kodePropinsi
    }
  }

  return null
}

export function getProvinceNameByKode(kode: string): string | null {
  const province = provinceMappings.find(p => p.kodePropinsi === kode)
  return province ? province.name : null
}

export function getAllProvinces(): ProvinceMapping[] {
  return provinceMappings.sort((a, b) => {
    // Sort by kode, but keep "Nasional" at the top
    if (a.kodePropinsi === "00") return -1
    if (b.kodePropinsi === "00") return 1
    return a.kodePropinsi.localeCompare(b.kodePropinsi)
  })
}