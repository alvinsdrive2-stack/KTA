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
  private overrideTokens: string[] | null = null
  private testMode: boolean

  constructor(token?: string, testMode: boolean = false) {
    if (token) {
      this.overrideTokens = [token]
    }
    this.testMode = testMode
  }

  // Lazy getter for token list - reads from process.env at runtime
  private getTokens(): string[] {
    if (this.overrideTokens) return this.overrideTokens
    return [
      process.env.SIKI_TOKEN_GKK || '',
      process.env.SIKI_TOKEN_GATAKSINDO || '',
      process.env.SIKI_TOKEN_MIK || '',
    ].filter(Boolean) as string[]
  }

  // Fetch with token fallback: try each token, stop on non-401
  private async fetchWithFallback(url: string, options: RequestInit = {}): Promise<{ response: Response; token: string } | null> {
    const tokens = this.getTokens()
    const baseHeaders = { 'Content-Type': 'application/json', ...options.headers }

    for (const token of tokens) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: { ...baseHeaders, 'token': token },
        })

        if (response.status !== 401) {
          return { response, token }
        }

        console.warn(`Token failed with 401, trying next token...`)
      } catch (error) {
        console.warn(`Request failed with token, trying next...`, error)
      }
    }

    console.error('All SIKI tokens exhausted (all returned 401 or failed)')
    return null
  }

  async getJabatanKerjaList(): Promise<any> {
    try {
      const result = await this.fetchWithFallback(`${this.baseUrlV2}/jabatan-kerja`)
      if (!result || !result.response.ok) {
        console.error('Failed to fetch jabatan-kerja list:', result?.response.status || 'no response')
        return null
      }
      return await result.response.json()
    } catch (error) {
      console.error('Error fetching jabatan-kerja list:', error)
      return null
    }
  }

  async getSubklasifikasiList(): Promise<any> {
    try {
      const result = await this.fetchWithFallback(`${this.baseUrlV2}/subklasifikasi`)
      if (!result || !result.response.ok) {
        console.error('Failed to fetch subklasifikasi list:', result?.response.status || 'no response')
        return null
      }
      return await result.response.json()
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

  // Fetch single URL with token fallback, returns null on total failure
  private async fetchSingleWithFallback(url: string, signal?: AbortSignal): Promise<Response | null> {
    const tokens = this.getTokens()

    for (const token of tokens) {
      try {
        const response = await fetch(url, {
          headers: { 'token': token, 'Content-Type': 'application/json' },
          signal,
        })
        if (response.status !== 401) {
          return response
        }
        console.warn(`Token failed with 401 for ${url}, trying next...`)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error
        console.warn(`Request failed for ${url}, trying next token...`, error)
      }
    }
    return null
  }

  async getPermohonanSKK(idIzin: string): Promise<SIKIResponse> {
    try {
      // Check if token is available
      const tokens = this.getTokens()
      if (tokens.length === 0) {
        console.error('No SIKI tokens configured')
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

      // Fetch from all 3 endpoints in parallel with token fallback
      const urls = {
        skk: `${this.baseUrl}/permohonan-skk/${idIzin}`,
        fg: `${this.baseUrl}/permohonan-skk-fg/${idIzin}`,
        balai: `${this.baseUrl}/permohonan-skk-balai/${idIzin}`,
      }

      console.log('Fetching SIKI data from multiple endpoints with token fallback:', Object.keys(urls))

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      try {
        // Fetch each endpoint with token fallback, in parallel
        const responses = await Promise.allSettled([
          this.fetchSingleWithFallback(urls.skk, controller.signal),
          this.fetchSingleWithFallback(urls.fg, controller.signal),
          this.fetchSingleWithFallback(urls.balai, controller.signal),
        ])

        clearTimeout(timeoutId)

        // Parse all responses
        const results = await Promise.all(
          responses.map(async (result, index) => {
            const endpointName = Object.keys(urls)[index]
            if (result.status === 'fulfilled' && result.value) {
              try {
                const response = result.value
                const rawText = await response.text()

                if (response.status === 401 || rawText.includes('Unauthorized')) {
                  return { endpoint: endpointName, error: 'Unauthorized (all tokens exhausted)' }
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
            return { endpoint: endpointName, error: result.status === 'fulfilled' ? 'All tokens failed' : String(result.reason) }
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

// Tokens from env - used by API routes that need direct token access
export function getSikiTokens(): string[] {
  return [
    process.env.SIKI_TOKEN_GKK || '',
    process.env.SIKI_TOKEN_GATAKSINDO || '',
    process.env.SIKI_TOKEN_MIK || '',
  ].filter(Boolean)
}

// Fetch with token fallback - for API routes that call SIKI directly
export async function fetchSikiWithFallback(url: string, options: RequestInit = {}): Promise<{ response: Response; token: string } | null> {
  const tokens = getSikiTokens()
  const baseHeaders = { 'Content-Type': 'application/json', ...options.headers }

  for (const token of tokens) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...baseHeaders, 'token': token },
      })
      if (response.status !== 401) {
        return { response, token }
      }
      console.warn(`SIKI token failed with 401, trying next...`)
    } catch (error) {
      console.warn(`SIKI request failed, trying next token...`, error)
    }
  }
  return null
}