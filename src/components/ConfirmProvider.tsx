import { useCallback, useState, type ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { ConfirmCtx, type ConfirmRequest } from './confirmContext'

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmRequest | null>(null)
  const request = useCallback((r: ConfirmRequest) => setReq(r), [])

  return (
    <ConfirmCtx.Provider value={request}>
      {children}
      <ConfirmDialog
        open={req !== null}
        title={req?.title ?? ''}
        description={req?.description}
        confirmLabel={req?.confirmLabel}
        danger={req?.danger}
        onCancel={() => setReq(null)}
        onConfirm={() => {
          req?.onConfirm()
          setReq(null)
        }}
      />
    </ConfirmCtx.Provider>
  )
}
