import * as https from 'https'
import * as http from 'http'
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
      // Create a custom https agent that ignores self-signed certificates
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      })

      const url = `${this.baseUrl}/permohonan-skk/${idIzin}`

      // Using native https module instead of fetch
      return new Promise((resolve, reject) => {
        const request = https.get(url, {
          headers: {
            'token': this.token,
            'Content-Type': 'application/json',
          },
          agent: httpsAgent,
        }, (response) => {
          let data = ''

          response.on('data', (chunk) => {
            data += chunk
          })

          response.on('end', () => {
            try {
              // Check if response is HTML (likely a block page)
              if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                resolve({
                  success: false,
                  message: 'Access to SIKI API is blocked by firewall/security system. Please contact your network administrator to whitelist siki.pu.go.id'
                })
                return
              }

              const jsonData = JSON.parse(data)

              if (response.statusCode !== 200) {
                resolve({
                  success: false,
                  message: jsonData.message || `HTTP error! status: ${response.statusCode}`
                })
                return
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

                resolve({
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
                })
              } else {
                resolve({
                  success: false,
                  message: 'Data not found'
                })
              }
            } catch (parseError) {
              if (data.includes('FortiGuard') || data.includes('blocked')) {
                resolve({
                  success: false,
                  message: 'Access to SIKI API is blocked by FortiGuard firewall. Please whitelist siki.pu.go.id in your security settings.'
                })
              } else {
                resolve({
                  success: false,
                  message: `Failed to parse SIKI API response. Server returned non-JSON data.`
                })
              }
            }
          })
        })

        request.on('error', (error) => {
          reject(error)
        })

        request.setTimeout(10000, () => {
          request.destroy()
          reject(new Error('Request timeout'))
        })
      })
    } catch (error) {
      console.error('SIKI API Error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
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