/**
 * Mapping nama daerah ke URL logo lambang provinsi dari Wikimedia Commons
 * URL Pattern: https://upload.wikimedia.org/wikipedia/commons/[folder]/[filename]
 */

export function getDaerahLogoUrl(namaDaerah: string): string {
  // Mapping langsung ke file SVG/PNG di Wikimedia Commons
  const mapping: Record<string, string> = {
    // Sumatera
    'Aceh': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Coat_of_arms_of_Aceh.svg',
    'Sumatera Utara': 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Coat_of_arms_of_North_Sumatra.svg',
    'Sumatera Barat': 'https://upload.wikimedia.org/wikipedia/commons/5/56/Coat_of_arms_West_Sumatera.png',
    'Riau': 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Coat_of_arms_of_Riau.svg',
    'Kepulauan Riau': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Coat_of_arms_of_Riau_Islands.svg',
    'Jambi': 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Coat_of_arms_of_Jambi.svg',
    'Sumatera Selatan': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Coat_of_arms_of_South_Sumatra.svg',
    'Bengkulu': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Coat_of_arms_of_Bengkulu.svg',
    'Lampung': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Coat_of_arms_of_Lampung.svg',
    'Bangka Belitung': 'https://upload.wikimedia.org/wikipedia/commons/0/08/Coat_of_arms_of_Bangka_Belitung_Islands.svg',
    'Kepulauan Bangka Belitung': 'https://upload.wikimedia.org/wikipedia/commons/0/08/Coat_of_arms_of_Bangka_Belitung_Islands.svg',

    // Jawa
    'DKI Jakarta': 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Coat_of_arms_of_Jakarta.svg',
    'Jakarta': 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Coat_of_arms_of_Jakarta.svg',
    'Banten': 'https://upload.wikimedia.org/wikipedia/commons/5/52/Coat_of_arms_of_Banten.svg',
    'Jawa Barat': 'https://upload.wikimedia.org/wikipedia/commons/9/99/Coat_of_arms_of_West_Java.svg',
    'Jawa Tengah': 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Coat_of_arms_of_Central_Java.svg',
    'DI Yogyakarta': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Coat_of_arms_of_Yogyakarta.svg',
    'Yogyakarta': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Coat_of_arms_of_Yogyakarta.svg',
    'Jawa Timur': 'https://upload.wikimedia.org/wikipedia/commons/7/74/Coat_of_arms_of_East_Java.svg',

    // Bali & Nusa Tenggara
    'Bali': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Official_seal_of_the_Province_of_Bali.png',
    'Nusa Tenggara Barat': 'https://upload.wikimedia.org/wikipedia/commons/5/51/Coat_of_arms_of_West_Nusa_Tenggara.svg',
    'Nusa Tenggara Timur': 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Coat_of_Arms_of_East_Nusa_Tenggara_NEW.png',

    // Kalimantan
    'Kalimantan Barat': 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Coat_of_arms_of_West_Kalimantan.svg',
    'Kalimantan Tengah': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Coat_of_arms_of_Central_Kalimantan.svg',
    'Kalimantan Selatan': 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Coat_of_arms_of_South_Kalimantan.svg',
    'Kalimantan Timur': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Coat_of_arms_of_East_Kalimantan.svg',
    'Kalimantan Utara': 'https://upload.wikimedia.org/wikipedia/commons/2/21/Coat_of_arms_of_North_Kalimantan_%282021_version%29.svg',

    // Sulawesi
    'Sulawesi Utara': 'https://upload.wikimedia.org/wikipedia/commons/6/68/Coat_of_arms_of_North_Sulawesi.svg',
    'Gorontalo': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Coat_of_arms_of_Gorontalo.svg',
    'Sulawesi Tengah': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Coat_of_arms_of_Central_Sulawesi.svg',
    'Sulawesi Barat': 'https://upload.wikimedia.org/wikipedia/commons/8/89/Coat_of_arms_of_West_Sulawesi.svg',
    'Sulawesi Selatan': 'https://upload.wikimedia.org/wikipedia/commons/6/67/Coat_of_arms_of_South_Sulawesi.svg',
    'Sulawesi Tenggara': 'https://upload.wikimedia.org/wikipedia/commons/3/31/Coat_of_arms_of_Southeast_Sulawesi.svg',

    // Maluku & Papua
    'Maluku': 'https://upload.wikimedia.org/wikipedia/commons/3/39/Coat_of_arms_of_Maluku.svg',
    'Maluku Utara': 'https://upload.wikimedia.org/wikipedia/commons/7/73/Coat_of_arms_of_North_Maluku.svg',
    'Papua Barat': 'https://upload.wikimedia.org/wikipedia/commons/d/de/Coat_of_arms_of_West_Papua.svg',
    'Papua': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Coat_of_arms_of_Papua_2.svg',
    'Papua Barat Daya': 'https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_Papua_Barat_Daya1.png',
    'Papua Tengah': 'https://upload.wikimedia.org/wikipedia/commons/9/96/Lambang_Papua_Tengah.png',
    'Papua Pegunungan': 'https://upload.wikimedia.org/wikipedia/commons/2/27/Lambang_Papua_Pegunungan.svg',
    'Papua Selatan': 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Logo_Papua_Selatan.png',
  }

  // Return mapped URL or fallback
  return mapping[namaDaerah] || getFallbackLogoUrl(namaDaerah)
}

// Fallback logo jika tidak ada di mapping
export function getFallbackLogoUrl(namaDaerah: string): string {
  // Gunakan logo Gatensi untuk nasional/daerah yang tidak ada di mapping
  return '/logo.png'
}
