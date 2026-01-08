'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface InvoiceKTA {
  id: string
  idIzin: string
  nama: string
  nik: string
  jenjang: string
  hargaFinal: number
}

interface InvoiceCreationContextType {
  invoiceKTAs: InvoiceKTA[]
  setInvoiceKTAs: (ktas: InvoiceKTA[]) => void
  clearInvoiceKTAs: () => void
  totalCount: number
  totalAmount: number
}

const InvoiceCreationContext = createContext<InvoiceCreationContextType | undefined>(undefined)

export function InvoiceCreationProvider({ children }: { children: ReactNode }) {
  const [invoiceKTAs, setInvoiceKTAs] = useState<InvoiceKTA[]>([])

  const clearInvoiceKTAs = () => {
    setInvoiceKTAs([])
  }

  const totalCount = invoiceKTAs.length
  const totalAmount = invoiceKTAs.reduce((sum, kta) => sum + (kta.hargaFinal || 0), 0)

  return (
    <InvoiceCreationContext.Provider
      value={{
        invoiceKTAs,
        setInvoiceKTAs,
        clearInvoiceKTAs,
        totalCount,
        totalAmount,
      }}
    >
      {children}
    </InvoiceCreationContext.Provider>
  )
}

export function useInvoiceCreation() {
  const context = useContext(InvoiceCreationContext)
  if (!context) {
    throw new Error('useInvoiceCreation must be used within InvoiceCreationProvider')
  }
  return context
}
