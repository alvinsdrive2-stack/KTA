'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface SelectedKTA {
  id: string
  idIzin: string
  nama: string
  nik: string
  jenjang: string
  hargaFinal: number
}

interface PaymentSelectionContextType {
  selectedRequests: SelectedKTA[]
  addRequest: (request: SelectedKTA) => void
  removeRequest: (requestId: string) => void
  clearSelection: () => void
  selectedCount: number
  totalAmount: number
}

const PaymentSelectionContext = createContext<PaymentSelectionContextType | undefined>(undefined)

export function PaymentSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedRequests, setSelectedRequests] = useState<SelectedKTA[]>([])

  const addRequest = useCallback((request: SelectedKTA) => {
    setSelectedRequests(prev => {
      if (prev.find(r => r.id === request.id)) return prev
      return [...prev, request]
    })
  }, [])

  const removeRequest = useCallback((requestId: string) => {
    setSelectedRequests(prev => prev.filter(r => r.id !== requestId))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedRequests([])
  }, [])

  const selectedCount = selectedRequests.length
  const totalAmount = selectedRequests.reduce((sum, req) => sum + (req.hargaFinal || 0), 0)

  const value = {
    selectedRequests,
    addRequest,
    removeRequest,
    clearSelection,
    selectedCount,
    totalAmount,
  }

  return (
    <PaymentSelectionContext.Provider value={value}>
      {children}
    </PaymentSelectionContext.Provider>
  )
}

export function usePaymentSelection() {
  const context = useContext(PaymentSelectionContext)
  if (!context) {
    throw new Error('usePaymentSelection must be used within PaymentSelectionProvider')
  }
  return context
}
