import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastCtx, type ToastAction, type ToastTone } from './toastContext'

interface Toast {
  id: number
  message: string
  tone: ToastTone
  action?: ToastAction
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const seq = useRef(0)

  const push = useCallback((message: string, tone: Toast['tone'] = 'ok', action?: ToastAction) => {
    const id = ++seq.current
    setItems((xs) => [...xs, { id, message, tone, action }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), action ? 5000 : 2600)
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`fade-in flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
              t.action ? 'pointer-events-auto' : ''
            } ${
              t.tone === 'error'
                ? 'bg-danger text-danger-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="shrink-0 font-bold uppercase tracking-wider text-primary"
                onClick={() => {
                  t.action?.onClick()
                  setItems((xs) => xs.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
