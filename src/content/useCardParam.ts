import { useSearchParams } from 'react-router'

/** Card aberto no painel lateral, guardado na URL (?card=) para o link poder ser compartilhado. */
export function useCardParam(): [string | null, (id: string) => void, () => void] {
  const [params, setParams] = useSearchParams()
  const open = (id: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('card', id)
      return n
    })
  const close = () =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('card')
      return n
    })
  return [params.get('card'), open, close]
}
