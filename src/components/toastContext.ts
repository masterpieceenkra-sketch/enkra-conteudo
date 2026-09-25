import { createContext, useContext } from 'react'

export type ToastTone = 'ok' | 'error'
/** Ação opcional no aviso, tipo "Desfazer". Fica visível enquanto o aviso aparece. */
export interface ToastAction {
  label: string
  onClick: () => void
}
export type PushToast = (message: string, tone?: ToastTone, action?: ToastAction) => void

export const ToastCtx = createContext<PushToast>(() => {})

export function useToast(): PushToast {
  return useContext(ToastCtx)
}
