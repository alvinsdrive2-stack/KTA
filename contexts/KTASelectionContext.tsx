'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface SelectedKTAForDownload {
  id: string
  nomorKTA: string | null
  nama: string
  kartuGeneratedPath: string | null
}

interface KTASelectionContextType {
  selectedKTAs: SelectedKTAForDownload[]
  addKTA: (kta: SelectedKTAForDownload) => void
  removeKTA: (ktaId: string) => void
  toggleKTA: (kta: SelectedKTAForDownload) => void
  clearSelection: () => void
  selectedCount: number
}

const KTASelectionContext = createContext<KTASelectionContextType | undefined>(undefined)

export function KTASelectionProvider({ children }: { children: ReactNode }) {
  const [selectedKTAs, setSelectedKTAs] = useState<SelectedKTAForDownload[]>([])

  const addKTA = useCallback((kta: SelectedKTAForDownload) => {
    setSelectedKTAs(prev => {
      if (prev.find(k => k.id === kta.id)) return prev
      return [...prev, kta]
    })
  }, [])

  const removeKTA = useCallback((ktaId: string) => {
    setSelectedKTAs(prev => prev.filter(k => k.id !== ktaId))
  }, [])

  const toggleKTA = useCallback((kta: SelectedKTAForDownload) => {
    setSelectedKTAs(prev => {
      const exists = prev.find(k => k.id === kta.id)
      if (exists) {
        return prev.filter(k => k.id !== kta.id)
      } else {
        return [...prev, kta]
      }
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedKTAs([])
  }, [])

  const selectedCount = selectedKTAs.length

  const value = {
    selectedKTAs,
    addKTA,
    removeKTA,
    toggleKTA,
    clearSelection,
    selectedCount,
  }

  return (
    <KTASelectionContext.Provider value={value}>
      {children}
    </KTASelectionContext.Provider>
  )
}

export function useKTASelection() {
  const context = useContext(KTASelectionContext)
  if (!context) {
    throw new Error('useKTASelection must be used within KTASelectionProvider')
  }
  return context
}
