import { createContext, useContext } from 'react'

export interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
}

export const ConfirmCtx = createContext<(req: ConfirmRequest) => void>(() => {})

/** Pede confirmação através de um único diálogo montado pelo ConfirmProvider. */
export function useConfirm() {
  return useContext(ConfirmCtx)
}
