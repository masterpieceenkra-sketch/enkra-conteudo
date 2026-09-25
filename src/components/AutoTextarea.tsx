import { useLayoutEffect, useRef, type Ref } from 'react'

interface Props {
  id?: string
  ref?: Ref<HTMLTextAreaElement>
  value: string
  onChange: (value: string) => void
  minRows?: number
  placeholder?: string
  className?: string
  'aria-label'?: string
}

/**
 * Textarea que cresce com o conteúdo, sem scroll interno.
 * Altura mínima vem de `minRows` (garantida por CSS, mesmo antes de o elemento ficar visível);
 * o ajuste por JS só amplia, e é refeito quando o elemento aparece (ex.: dentro de um dialog).
 */
export function AutoTextarea({
  value,
  onChange,
  minRows = 3,
  className = '',
  ref: outerRef,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const setRef = (el: HTMLTextAreaElement | null) => {
    ref.current = el
    if (typeof outerRef === 'function') outerRef(el)
    else if (outerRef) outerRef.current = el
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto'
      // scrollHeight é 0 enquanto o elemento está oculto; nesse caso deixa a altura mínima do CSS
      if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value])

  return (
    <textarea
      ref={setRef}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} auto-grow resize-none overflow-hidden`}
      style={{ minHeight: `calc(${minRows} * 1.5em + 1.125rem)` }}
      {...rest}
    />
  )
}
