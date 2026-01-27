/**
 * Check ASAP API response structure
 */

async function main() {
  console.log('Fetching from: https://asap.lspgatensi.id/api/jabker\n')

  const response = await fetch('https://asap.lspgatensi.id/api/jabker')
  console.log('Status:', response.status)
  console.log('Content-Type:', response.headers.get('content-type'))

  const text = await response.text()
  console.log('\nRaw response (first 1000 chars):')
  console.log(text.substring(0, 1000))

  console.log('\n\nResponse length:', text.length, 'chars')

  try {
    const json = JSON.parse(text)
    console.log('\nParsed JSON structure:')
    console.log(JSON.stringify(json, null, 2).substring(0, 2000))
  } catch (e) {
    console.log('\n❌ Not valid JSON')
  }
}

main()
