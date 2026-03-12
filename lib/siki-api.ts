import { extractProvinceFromAddress, getProvinceNameByKode } from './province-mapping'
import { getOrCreateJabatanKerja } from './jabker-lookup'

interface SIKIData {
  nik: string
  nama: string
  jabatan: string
  subklasifikasi: string
  jenjang: string
  telp: string
  email: string
  alamat: string
  tgl_daftar: string
  ktpUrl?: string
  fotoUrl?: string
  kodePropinsi?: string  // Added for province mapping
  namaProvinsi?: string  // Added for province name
}

interface SIKIResponse {
  success: boolean
  data?: SIKIData
  message?: string
}

export class SIKIApiClient {
  private baseUrl = 'https://siki.pu.go.id/siki-api/v1'
  private baseUrlV2 = 'https://siki.pu.go.id/siki-api/v2'
  private overrideToken: string | null = null
  private testMode: boolean

  constructor(token?: string, testMode: boolean = false) {
    // Store override token if provided, but read process.env lazily
    this.overrideToken = token || null
    // Allow test mode override
    this.testMode = testMode
  }

  // Lazy getter for token - reads from process.env at runtime, not at module load
  private getToken(): string {
    return this.overrideToken || process.env.SIKI_API_TOKEN || ''
  }

  async getJabatanKerjaList(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrlV2}/jabatan-kerja`, {
        headers: {
          'token': this.getToken(),
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Failed to fetch jabatan-kerja list:', response.status)
        return null
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching jabatan-kerja list:', error)
      return null
    }
  }

  async getSubklasifikasiList(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrlV2}/subklasifikasi`, {
        headers: {
          'token': this.getToken(),
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Failed to fetch subklasifikasi list:', response.status)
        return null
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching subklasifikasi list:', error)
      return null
    }
  }

  // Fetch jabatan kerja by code from local lookup table (with ASAP fallback)
  async getJabatanKerjaByCode(kodeJabker: string): Promise<string | null> {
    try {
      console.log(`Looking up jabatan kerja: "${kodeJabker}"`)

      // Use hybrid lookup: check local table first, then fetch from ASAP if not found
      const jabatanKerja = await getOrCreateJabatanKerja(kodeJabker)

      console.log(`✓ Found jabatan kerja: "${kodeJabker}" → "${jabatanKerja}"`)
      return jabatanKerja
    } catch (error) {
      console.error('Error fetching jabatan kerja by code:', error)
      return null
    }
  }

  // Cache for subklasifikasi data
  private subklasifikasiCache: Map<string, string> | null = null

  // Clear cache method
  clearCache(): void {
    this.subklasifikasiCache = null
    console.log('Cache cleared')
  }

  async getSubklasifikasiName(kodeSubklasifikasi: string): Promise<string | null> {
    // Initialize cache if not already done
    if (this.subklasifikasiCache === null) {
      const data = await this.getSubklasifikasiList()
      if (data && data.data) {
        this.subklasifikasiCache = new Map()
        for (const item of data.data) {
          this.subklasifikasiCache.set(String(item.kode_subklasifikasi), item.subklasifikasi)
        }
      } else {
        this.subklasifikasiCache = new Map()
      }
    }

    return this.subklasifikasiCache.get(String(kodeSubklasifikasi)) || null
  }

  async getPermohonanSKK(idIzin: string): Promise<SIKIResponse> {
    try {
      // Check if token is available
      if (!this.getToken() || this.getToken().trim() === '') {
        console.error('SIKI_API_TOKEN is not set or empty')
        return {
          success: false,
          message: 'Permohonan sudah ada tidak dapat menambahkan permohonan dengan id yang sama'
        }
      }

      // Return mock data in test mode
      if (this.testMode) {
        console.log('Using mock data for SIKI API in test mode')
        return {
          success: true,
          data: {
            nik: '1234567890123456',
            nama: 'Ahmad Test User',
            jabatan: 'Ahli Muda',
            subklasifikasi: 'Bangunan Gedung',
            jenjang: 'Muda',
            telp: '081234567890',
            email: 'ahmad@test.com',
            alamat: 'Jl. Test No. 123, Jakarta',
            tgl_daftar: '2024-01-01',
            ktpUrl: 'https://perizinan.pu.go.id/portal/admin/assets/upload/cdn/document/2025/12/10/1781059/866536-ktp-69397653b035a.pdf',
            fotoUrl: 'https://perizinan.pu.go.id/portal/admin/assets/upload/cdn/document/2025/12/10/1781059/866536-WhatsApp-Image-2025-12-10-at-17494480d62358-6939765398be8.jpg',
          }
        }
      }

      // Fetch from all 3 endpoints in parallel
      const urls = {
        skk: `${this.baseUrl}/permohonan-skk/${idIzin}`,
        fg: `${this.baseUrl}/permohonan-skk-fg/${idIzin}`,
        balai: `${this.baseUrl}/permohonan-skk-balai/${idIzin}`,
      }

      console.log('Fetching SIKI data from multiple endpoints:', Object.keys(urls))

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      try {
        // Fetch all endpoints in parallel
        const responses = await Promise.allSettled([
          fetch(urls.skk, {
            headers: { 'token': this.getToken(), 'Content-Type': 'application/json' },
            signal: controller.signal,
          }),
          fetch(urls.fg, {
            headers: { 'token': this.getToken(), 'Content-Type': 'application/json' },
            signal: controller.signal,
          }),
          fetch(urls.balai, {
            headers: { 'token': this.getToken(), 'Content-Type': 'application/json' },
            signal: controller.signal,
          }),
        ])

        clearTimeout(timeoutId)

        // Parse all responses
        const results = await Promise.all(
          responses.map(async (result, index) => {
            const endpointName = Object.keys(urls)[index]
            if (result.status === 'fulfilled') {
              try {
                const response = result.value
                const rawText = await response.text()

                if (response.status === 401 || rawText.includes('Unauthorized')) {
                  return { endpoint: endpointName, error: 'Unauthorized' }
                }

                if (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')) {
                  return { endpoint: endpointName, error: 'HTML response' }
                }

                let jsonData
                try {
                  jsonData = JSON.parse(rawText)
                } catch {
                  return { endpoint: endpointName, error: 'Invalid JSON' }
                }

                if (response.status === 200 && jsonData?.status === 'success' && jsonData?.personal?.length > 0) {
                  return { endpoint: endpointName, data: jsonData }
                }

                return { endpoint: endpointName, error: 'No data' }
              } catch (e) {
                return { endpoint: endpointName, error: String(e) }
              }
            }
            return { endpoint: endpointName, error: result.reason }
          })
        )

        console.log('SIKI API results:', results.map(r => ({ endpoint: r.endpoint, hasData: !!r.data })))

        // Find the first successful response
        const successfulResult = results.find(r => r.data)

        if (!successfulResult) {
          console.log('No successful responses from any endpoint')
          return {
            success: false,
            message: 'Data not found in SIKI (tried all endpoints)'
          }
        }

        const jsonData = successfulResult.data
        const personal = jsonData.personal[0]
        const klasifikasi = jsonData.klasifikasi_kualifikasi && jsonData.klasifikasi_kualifikasi.length > 0
          ? jsonData.klasifikasi_kualifikasi[0]
          : {}

        // Extract province from address
        const alamat = personal.alamat || ''
        const kodePropinsi = extractProvinceFromAddress(alamat)
        const namaProvinsi = kodePropinsi ? getProvinceNameByKode(kodePropinsi) : null

        console.log(`Using data from ${successfulResult.endpoint} for ${personal.nama}:`, {
          alamat,
          kodePropinsi,
          namaProvinsi
        })

        return {
          success: true,
          data: {
            nik: personal.nik || '',
            nama: personal.nama || '',
            jabatan: klasifikasi.jabatan_kerja || '',
            subklasifikasi: klasifikasi.subklasifikasi || '',
            jenjang: klasifikasi.jenjang || '',
            telp: personal.telepon || '',
            email: personal.email || '',
            alamat: alamat,
            tgl_daftar: personal.created || new Date().toISOString(),
            ktpUrl: personal.ktp || null,
            fotoUrl: personal.pas_foto || null,
            kodePropinsi: kodePropinsi || undefined,
            namaProvinsi: namaProvinsi || undefined,
          }
        }
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          return {
            success: false,
            message: 'SIKI API request timeout. The server took too long to respond.'
          }
        }
        throw fetchError
      }
    } catch (error) {
      console.error('SIKI API Error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred while fetching SIKI data'
      }
    }
  }

  async getPekerjaByIdIzin(idIzin: string): Promise<SIKIResponse> {
    return this.getPermohonanSKK(idIzin)
  }

  validateIdIzin(idIzin: string): boolean {
    // Basic validation for ID Izin format
    return /^[A-Za-z0-9\-_]{5,50}$/.test(idIzin)
  }
}

// Create singleton instance
export const sikiApi = new SIKIApiClient()