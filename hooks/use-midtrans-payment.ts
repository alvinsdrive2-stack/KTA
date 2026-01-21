import { useState, useCallback } from 'react'
import { openSnapPopup, generateSnapToken, type SnapResult } from '@/lib/midtrans-client'

export interface PaymentResult {
  success: boolean
  pending?: boolean
  data?: SnapResult
  error?: string
  token?: string
  redirectUrl?: string
}

export function useMidtransPayment() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = useCallback(
    async (invoiceId: string): Promise<PaymentResult> => {
      setIsLoading(true)
      setError(null)

      try {
        // Generate Snap token
        console.log('Generating Snap token for invoice:', invoiceId)
        const response = await generateSnapToken(invoiceId)
        const { token, redirect_url } = response

        // Log token untuk debugging
        console.log('========================================')
        console.log('MIDTRANS TOKEN GENERATED:')
        console.log('Token:', token)
        console.log('Redirect URL:', redirect_url)
        console.log('Invoice Number:', response.invoice_number)
        console.log('Amount:', response.amount)
        console.log('========================================')

        // Open Snap popup and wait for result
        return new Promise<PaymentResult>((resolve) => {
          openSnapPopup(token, {
            onSuccess: (result) => {
              setIsLoading(false)
              resolve({
                success: true,
                data: result,
                token,
                redirectUrl: redirect_url
              })
            },
            onPending: (result) => {
              setIsLoading(false)
              resolve({
                success: false,
                pending: true,
                data: result,
                token,
                redirectUrl: redirect_url
              })
            },
            onError: (result) => {
              setIsLoading(false)
              setError(result.status_message || 'Payment failed')
              resolve({
                success: false,
                data: result,
                error: result.status_message,
                token,
                redirectUrl: redirect_url
              })
            },
            onClose: () => {
              setIsLoading(false)
              resolve({
                success: false,
                error: 'Payment popup closed',
                token,
                redirectUrl: redirect_url
              })
            }
          })
        })
      } catch (err) {
        setIsLoading(false)
        const errorMessage = err instanceof Error ? err.message : 'Failed to process payment'
        setError(errorMessage)
        return {
          success: false,
          error: errorMessage
        }
      }
    },
    []
  )

  return {
    pay,
    isLoading,
    error
  }
}
