'use client'

import { useState } from 'react'

// Dummy data untuk testing
const dummyData = {
  nama: 'AHMAD SURYADI PRATAMA SETIAWAN PUTRA',
  alamat: 'Jl. Merdeka No. 123 Jakarta Pusat Selatan Indonesia Asia',
  nomorKTA: 'KTA-DKI-2024-0001',
  issuedDate: '01/2024',
  expiredDate: '01/2029',
}

// Helper function untuk format nama max 25 chars dengan singkatan
const formatNama = (nama: string) => {
  const maxChars = 25

  if (nama.length <= maxChars) {
    return nama
  }

  // Split nama menjadi kata-kata
  const words = nama.trim().split(/\s+/)

  if (words.length <= 2) {
    // Jika cuma 2 kata atau kurang, truncate saja
    return nama.slice(0, maxChars - 3) + '...'
  }

  // Jika lebih dari 2 kata, buat singkatan
  // Format: Firstname + Initial(s) + Lastname
  const firstWord = words[0]
  const lastWord = words[words.length - 1]
  const middleWords = words.slice(1, -1)

  let abbreviated = firstWord
  for (const word of middleWords) {
    const initial = word.charAt(0) + '.'
    if ((abbreviated + ' ' + initial + ' ' + lastWord).length <= maxChars) {
      abbreviated += ' ' + initial
    } else {
      break
    }
  }

  // Tambah last name kalo muat
  if ((abbreviated + ' ' + lastWord).length <= maxChars) {
    abbreviated += ' ' + lastWord
  }

  return abbreviated
}

// Helper function untuk split alamat berdasarkan kata (word-based)
// Line 1: max 28 chars, Line 2: max 43 chars, Line 3: max 43 chars
// Jika 1 kata tidak muat di line tersebut, pindah ke line berikutnya
const formatAlamat = (alamat: string) => {
  const maxLine1 = 28
  const maxLine2 = 43
  const maxLine3 = 43

  const words = alamat.split(' ')
  const lines: string[] = []
  let currentLine = ''

  // Build line 1
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (lines.length === 0 && testLine.length <= maxLine1) {
      currentLine = testLine
    } else if (lines.length === 0 && currentLine) {
      // Word doesn't fit in line 1, move to line 2
      lines.push(currentLine)
      currentLine = word
    } else if (lines.length === 1) {
      break
    }
  }
  if (lines.length === 0 && currentLine) {
    lines.push(currentLine)
    currentLine = ''
  }

  // Build line 2
  const startIndexLine2 = lines[0] ? lines[0].split(' ').length : 0
  let line2Words: string[] = []
  for (let i = startIndexLine2; i < words.length; i++) {
    const testLine = line2Words.join(' ') + (line2Words.length ? ' ' : '') + words[i]
    if (testLine.length <= maxLine2) {
      line2Words.push(words[i])
    } else if (line2Words.length === 0) {
      // Single word too long for line 2, add it anyway
      line2Words.push(words[i])
      break
    } else {
      break
    }
  }
  if (line2Words.length > 0) {
    lines.push(line2Words.join(' '))
  }

  // Build line 3 (remaining words)
  const startIndexLine3 = startIndexLine2 + line2Words.length
  const line3Words = words.slice(startIndexLine3)
  if (line3Words.length > 0) {
    const line3 = line3Words.join(' ')
    lines.push(line3.length > maxLine3 ? line3.slice(0, maxLine3) : line3)
  }

  return lines.filter(l => l.length > 0)
}

export default function KTAPreviewPage() {
  const [showFront, setShowFront] = useState(true)
  const [data, setData] = useState(dummyData)

  // Helper function untuk capitalize each word
  const capitalizeEachWord = (text: string) => {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Helper function untuk format alamat dengan RT/RW uppercase
  const formatAlamatWithRW = (alamat: string) => {
    let formatted = capitalizeEachWord(alamat)
    // Replace RT/RW variations with proper format
    formatted = formatted.replace(/\b\/?rt\b/gi, '/RT')
    formatted = formatted.replace(/\b\/?rw\b/gi, '/RW')
    // Handle case without slash but with space after
    formatted = formatted.replace(/\brt\b/gi, 'RT')
    formatted = formatted.replace(/\brw\b/gi, 'RW')
    return formatted
  }

  const alamatLines = formatAlamat(data.alamat)
  const formattedNama = formatNama(data.nama)

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">KTA Preview - Test Text Overlay</h1>

        {/* Controls */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex gap-4 items-center">
            <button
              onClick={() => setShowFront(true)}
              className={`px-4 py-2 rounded ${showFront ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Front
            </button>
            <button
              onClick={() => setShowFront(false)}
              className={`px-4 py-2 rounded ${!showFront ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Back
            </button>
            <span className="text-sm text-gray-500">
              Edit posisi text di file ini langsung (ubah style top/left)
            </span>
          </div>
        </div>

        {/* KTA Card Preview - Container dengan posisi relatif */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="relative mx-auto" style={{ width: '600px', height: '380px' }}>
            {/* Template Background */}
            <img
              src={`/template kta/${showFront ? 'KTA AI - FRONT.svg' : 'KTA AI - BACK.svg'}`}
              alt={showFront ? 'KTA Front' : 'KTA Back'}
              className="absolute top-0 left-0 w-full h-full object-contain"
            />

            {/* FRONT: Text Overlays */}
            {showFront && (
              <>
                {/* Nama */}
                <div
                  className="absolute text-white"
                  style={{
                    top: '157px',
                    left: '330px',
                    fontSize: '18px',
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 500
                  }}
                >
                  {capitalizeEachWord(formattedNama)}
                </div>

                {/* Alamat - 3 lines: Line 1 max 20, Line 2 max 35, Line 3 max 20 */}
                {alamatLines.map((line, index) => (
                  <div
                    key={index}
                    className="absolute text-white"
                    style={{
                      top: `${183 + index * 24}px`,
                      left: index === 0 ? '330px' : '220px',
                      fontSize: '18px',
                      fontFamily: 'var(--font-manrope)',
                      fontWeight: 500
                    }}
                  >
                    {formatAlamatWithRW(line)}
                  </div>
                ))}

                {/* Nomor KTA */}
                <div
                  className="absolute text-white"
                  style={{
                    top: '132px',
                    left: '330px',
                    fontSize: '18px',
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 500
                  }}
                >
                  {data.nomorKTA.toUpperCase()}
                </div>

                {/* Issued Date MM/YYYY */}
                <div
                  className="absolute text-white flex items-center"
                  style={{
                    bottom: '46px',
                    right: '325px',
                    fontSize: '18px',
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 500,
                    gap: '8px'
                  }}
                >
                  <span>DOM </span>
                  <span>{data.issuedDate.toUpperCase()}</span>
                </div>

                {/* Expired Date MM/YYYY */}
                <div
                  className="absolute text-white flex items-center"
                  style={{
                    bottom: '19px',
                    right: '326px',
                    fontSize: '18px',
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 500,
                    gap: '13px'
                  }}
                >
                  <span>EXP </span>
                  <span>{data.expiredDate.toUpperCase()}</span>
                </div>

                {/* Photo placeholder */}
                <div
                  className="absolute border-2 border-white bg-gray-100 flex items-center justify-center"
                  style={{ top: '122px', right: '412px', width: '110px', height: '140px' }}
                >
                  <span className="text-xs text-gray-400">FOTO</span>
                </div>

                {/* QR Code placeholder */}
                <div
                  className="absolute border-2 border-white bg-white flex items-center justify-center"
                  style={{ bottom: '10px', right: '28px', width: '60px', height: '60px' }}
                >
                  <span className="text-xs text-gray-400">QR</span>
                </div>
              </>
            )}

           
          </div>
        </div>

        {/* Edit Dummy Data */}
        <div className="bg-white p-4 rounded-lg shadow mt-6">
          <h2 className="font-bold mb-3">Edit Dummy Data (untuk testing)</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-gray-600">Nama</label>
              <input
                type="text"
                value={data.nama}
                onChange={(e) => setData({ ...data, nama: e.target.value.toUpperCase() })}
                className="w-full border p-1 rounded"
              />
            </div>
            <div>
              <label className="block text-gray-600">Alamat</label>
              <input
                type="text"
                value={data.alamat}
                onChange={(e) => setData({ ...data, alamat: e.target.value })}
                className="w-full border p-1 rounded"
              />
            </div>
            <div>
              <label className="block text-gray-600">Nomor KTA</label>
              <input
                type="text"
                value={data.nomorKTA}
                onChange={(e) => setData({ ...data, nomorKTA: e.target.value })}
                className="w-full border p-1 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-gray-600">Issued (MM/YYYY)</label>
              <input
                type="text"
                value={data.issuedDate}
                onChange={(e) => setData({ ...data, issuedDate: e.target.value })}
                className="w-full border p-1 rounded font-mono"
                placeholder="01/2024"
              />
            </div>
            <div>
              <label className="block text-gray-600">Expired (MM/YYYY)</label>
              <input
                type="text"
                value={data.expiredDate}
                onChange={(e) => setData({ ...data, expiredDate: e.target.value })}
                className="w-full border p-1 rounded font-mono"
                placeholder="01/2029"
              />
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mt-6 text-sm">
          <h3 className="font-bold text-yellow-800 mb-2">Tips Adjust Posisi:</h3>
          <ul className="list-disc list-inside text-yellow-700 space-y-1">
            <li>Edit langsung nilai <code>top</code> dan <code>left</code> di file ini</li>
            <li>Save file → auto refresh browser (Next.js hot reload)</li>
            <li>Container size: 600px x 380px</li>
            <li>Kalo mau export ke PDF, copy posisi ini ke <code>lib/pdf-generator.ts</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
