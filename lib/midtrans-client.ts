/**
 * Midtrans Snap Client for Frontend
 * Helper functions to integrate Midtrans Snap popup
 */

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: SnapOptions) => void
    }
  }
}

export interface SnapOptions {
  // Called when popup is closed
  onClose?: () => void
  // Called when payment is successful
  onSuccess?: (result: SnapResult) => void
  // Called when payment is pending
  onPending?: (result: SnapResult) => void
  // Called when payment is failed
  onError?: (result: SnapResult) => void
}

export interface SnapResult {
  status_code: string
  status_message: string
  transaction_id: string
  order_id: string
  gross_amount: string
  payment_type: string
  transaction_time: string
  transaction_status: string
  fraud_status: string
  [key: string]: any
}

/**
 * Load Midtrans Snap.js script dynamically
 */
export function loadSnapScript(clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.snap) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js'
    script.setAttribute('data-client-key', clientKey)
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Midtrans Snap.js'))

    document.head.appendChild(script)
  })
}

/**
 * Open Midtrans Snap popup with token
 */
export async function openSnapPopup(
  token: string,
  options: SnapOptions = {}
): Promise<void> {
  try {
    // Get client key from env (exposed via next.config.js or API)
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''

    if (!clientKey) {
      throw new Error('Midtrans client key not configured')
    }

    // Load Snap.js if not already loaded
    await loadSnapScript(clientKey)

    // Open popup
    window.snap?.pay(token, {
      onSuccess: (result: SnapResult) => {
        console.log('Midtrans payment success:', result)
        options.onSuccess?.(result)
      },
      onPending: (result: SnapResult) => {
        console.log('Midtrans payment pending:', result)
        options.onPending?.(result)
      },
      onError: (result: SnapResult) => {
        console.error('Midtrans payment error:', result)
        options.onError?.(result)
      },
      onClose: () => {
        console.log('Midtrans popup closed')
        options.onClose?.()
      }
    })
  } catch (error) {
    console.error('Error opening Snap popup:', error)
    options.onError?.({
      status_code: '500',
      status_message: error instanceof Error ? error.message : 'Unknown error',
      order_id: '',
      gross_amount: '0',
      payment_type: '',
      transaction_time: '',
      transaction_status: 'error',
      fraud_status: ''
    })
  }
}

/**
 * Generate Snap token from API
 */
export async function generateSnapToken(invoiceId: string): Promise<{
  token: string
  redirect_url: string
  invoice_number: string
  amount: number
}> {
  const response = await fetch(`/api/payments/invoice/${invoiceId}/midtrans-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate payment token')
  }

  return response.json()
}
