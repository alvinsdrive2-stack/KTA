import { extractProvinceFromAddress, getProvinceNameByKode } from './province-mapping'

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
  private token: string
  private testMode: boolean

  constructor(token?: string, testMode: boolean = false) {
    this.token = token || process.env.SIKI_API_TOKEN || ''
    // Allow test mode override
    this.testMode = testMode
  }

  async getPermohonanSKK(idIzin: string): Promise<SIKIResponse> {
    try {
      // Check if token is available
      if (!this.token || this.token.trim() === '') {
        console.error('SIKI_API_TOKEN is not set or empty')
        return {
          success: false,
          message: 'SIKI API token is not configured. Please set SIKI_API_TOKEN environment variable.'
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

      const url = `${this.baseUrl}/permohonan-skk/${idIzin}`

      console.log('Fetching SIKI data from:', url)
      console.log('Token (first 10 chars):', this.token.substring(0, 10) + '...')

      // Use fetch API (more compatible with Vercel)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      try {
        const response = await fetch(url, {
          headers: {
            'token': this.token,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        console.log('SIKI API Response status:', response.status)
        console.log('SIKI API Response headers:', Object.fromEntries(response.headers.entries()))

        // Get raw text first for debugging
        const rawText = await response.text()
        console.log('SIKI API Response length:', rawText.length)
        console.log('SIKI API Response preview:', rawText.substring(0, 200))

        // Check for Unauthorized response
        if (response.status === 401 || rawText.includes('Unauthorized')) {
          console.error('SIKI API returned Unauthorized - token may be invalid or expired')
          return {
            success: false,
            message: 'SIKI API authentication failed. The API token may be invalid or expired. Please check SIKI_API_TOKEN environment variable.'
          }
        }

        // Check if response is HTML (likely a block page)
        if (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')) {
          console.error('SIKI API returned HTML instead of JSON')
          return {
            success: false,
            message: 'Access to SIKI API is blocked. The server returned an HTML response instead of JSON. This may be due to firewall or IP restrictions.'
          }
        }

        // Parse JSON
        let jsonData
        try {
          jsonData = JSON.parse(rawText)
        } catch (parseError) {
          console.error('Failed to parse SIKI API response as JSON:', rawText.substring(0, 500))
          return {
            success: false,
            message: 'Failed to parse SIKI API response. Server returned non-JSON data.'
          }
        }

        if (response.status !== 200) {
          return {
            success: false,
            message: jsonData.message || `HTTP error! status: ${response.status}`
          }
        }

        // Transform response data to match our schema
        if (jsonData && jsonData.status === 'success' && jsonData.personal && jsonData.personal.length > 0) {
          const personal = jsonData.personal[0]
          const klasifikasi = jsonData.klasifikasi_kualifikasi && jsonData.klasifikasi_kualifikasi.length > 0
            ? jsonData.klasifikasi_kualifikasi[0]
            : {}

          // Extract province from address
          const alamat = personal.alamat || ''
          const kodePropinsi = extractProvinceFromAddress(alamat)
          const namaProvinsi = kodePropinsi ? getProvinceNameByKode(kodePropinsi) : null

          console.log(`Province extraction for ${personal.nama}:`, {
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
        } else {
          return {
            success: false,
            message: 'Data not found in SIKI'
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