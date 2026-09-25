import { RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  CONTENT_MESSAGE_KINDS,
  LAUNCH_MESSAGE_KINDS,
  MESSAGE_KIND_INFO,
  TEMPLATE_MAX_LENGTH,
  defaultTemplate,
  fillTemplate,
  withBoardName,
  type MessageKind,
} from '../data/messageTemplates'
import { FORMAT_LABEL } from '../content/model'
import type { LaunchState, Task } from '../data/types'
import { boardUrl } from '../lib/board'
import { formatBr } from '../lib/dates'
import {
  allTasks,
  boardKind,
  boardName,
  useLaunchActions,
  useLaunchState,
} from '../store/launchStore'
import { AutoTextarea } from './AutoTextarea'
import { useProfile } from './useActor'
import { useToast } from './toastContext'

/** Mesmo formato da função SQL `comu_hub_checklist_text`. */
function checklistText(task: Task | undefined): string {
  return (task?.checklists ?? [])
    .map((c) => {
      const items = c.items.filter((i) => i.text.trim())
      if (!items.length) return ''
      return `${c.title.trim() || 'Checklist'}:\n${items
        .map((i) => `${i.done ? '✅' : '❌'} ${i.text.trim()}`)
        .join('\n')}`
    })
    .filter(Boolean)
    .join('\n\n')
}

/** Card mais completo do checklist, para a prévia ficar parecida com o uso real. */
function sampleTask(s: LaunchState): Task | undefined {
  const tasks = allTasks(s)
  const score = (t: Task) =>
    (t.due ? 2 : 0) + (t.checklists?.some((c) => c.items.length) ? 3 : 0) + (t.ownerId ? 1 : 0)
  return [...tasks].sort((a, b) => score(b) - score(a))[0]
}

function sampleValues(kind: MessageKind, s: LaunchState, actor: string): Record<string, string> {
  const origin = boardUrl()
  const firstName = actor.trim().split(/\s+/)[0] || 'Ana'
  if (kind === 'meeting') {
    const m = [...s.meetings].sort((a, b) => b.date.localeCompare(a.date))[0]
    return {
      nome: firstName,
      reuniao: m?.title ?? 'Weekly do lançamento',
      quando: m
        ? `${formatBr(m.date).slice(0, 5)}${m.time ? ` às ${m.time}` : ''}`
        : '25/09 às 10:00',
      link: m?.link ?? '',
      autor: actor,
    }
  }
  if (kind === 'welcome') {
    return { nome: firstName, link: origin, autor: actor }
  }
  if (CONTENT_MESSAGE_KINDS.includes(kind)) {
    // card mais recente com data, para a prévia parecer uso real
    const k =
      [...(s.content?.cards ?? [])].reverse().find((x) => x.publishAt) ?? s.content?.cards[0]
    const pub = k?.publishAt
      ? `${formatBr(k.publishAt).slice(0, 5)}${k.publishTime ? ` às ${k.publishTime}` : ''}`
      : '30/09 às 18:00'
    return {
      nome: firstName,
      conteudo: k?.title || '5 livros que todo empreendedor deveria ler',
      formato: FORMAT_LABEL[k?.format ?? 'carrossel'],
      publicacao: pub,
      prazo: k?.due ? formatBr(k.due).slice(0, 5) : '27/09',
      link: k ? `${origin}/quadro?card=${k.id}` : `${origin}/quadro`,
      quando: 'amanhã',
      lista:
        '• 5 livros que todo empreendedor deveria ler (Carrossel · 30/09)\n• Bastidor de reunião comercial (Reels · 01/10)',
      decisao: 'devolvido com ajuste ✏️',
      comentario:
        kind === 'content_decision' || kind === 'content_comment'
          ? 'Trocar a trilha e cortar os 3 primeiros segundos.'
          : '',
      autor: kind === 'card_due' || kind === 'content_publish_today' ? '' : actor,
    }
  }
  if (kind === 'cost_new' || kind === 'cost_decision') {
    return {
      nome: firstName,
      custo: 'Tráfego Meta Ads',
      valor: 'R$ 1.500,00',
      frequencia: 'mensal',
      categoria: 'Tráfego',
      data: '22/09',
      quem_pagou: actor || 'Wes',
      obs: 'Verba da semana de captação.',
      decisao: 'aprovado ✅',
      justificativa: kind === 'cost_decision' ? 'Valor acima do combinado.' : '',
      link: `${origin}/custos`,
      autor: actor,
    }
  }
  const t = sampleTask(s)
  const automatic = kind === 'due_tomorrow' || kind === 'due_today' || kind === 'overdue'
  return {
    nome: firstName,
    tarefa: t?.label ?? 'Criar página de captura',
    prazo: t?.due ? formatBr(t.due).slice(0, 5) : '',
    checklist: checklistText(t),
    link: t ? `${origin}/checklist?card=${t.id}` : origin,
    atraso: '3 dias',
    autor: automatic ? '' : actor,
  }
}

export function MessageTemplatesPanel() {
  const s = useLaunchState()
  const { setMessageTemplate } = useLaunchActions()
  const profile = useProfile()
  const toast = useToast()
  const isContent = boardKind(s) === 'content'
  const kinds = isContent ? CONTENT_MESSAGE_KINDS : LAUNCH_MESSAGE_KINDS
  const [kind, setKind] = useState<MessageKind>(kinds[0])
  const fallback = defaultTemplate(kind, isContent)
  const saved = s.messages?.[kind] ?? fallback
  const [draft, setDraft] = useState(saved)
  const [editingKind, setEditingKind] = useState(kind)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  if (editingKind !== kind) {
    setEditingKind(kind)
    setDraft(saved)
  }
  const info = MESSAGE_KIND_INFO[kind]
  const isDefault = saved === fallback
  const dirty = draft.trim() !== saved
  const preview = useMemo(
    () => fillTemplate(withBoardName(draft, boardName(s)), sampleValues(kind, s, profile.name)),
    [draft, kind, s, profile.name],
  )
  const missing = info.placeholders
    .filter((p) => (p.key === 'link' || p.key === 'nome') && !draft.includes(`{${p.key}}`))
    .map((p) => `{${p.key}}`)

  function insert(key: string) {
    const el = textareaRef.current
    const tag = `{${key}}`
    if (!el) {
      setDraft((d) => `${d}${tag}`)
      return
    }
    const start = el.selectionStart ?? draft.length
    const end = el.selectionEnd ?? start
    const next = `${draft.slice(0, start)}${tag}${draft.slice(end)}`
    setDraft(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + tag.length, start + tag.length)
    })
  }

  function save() {
    setMessageTemplate(kind, draft)
    toast(`${info.title}: texto salvo`)
  }

  return (
    <div className="sm:col-span-2">
      <p className="label-mono mb-2">Texto dos avisos</p>
      <div role="tablist" aria-label="Tipo de aviso" className="mb-3 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`chip ${kind === k ? 'chip-active' : ''}`}
            onClick={() => setKind(k)}
          >
            {MESSAGE_KIND_INFO[k].title}
            {s.messages?.[k] ? <span className="ml-1 text-primary">•</span> : null}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">{info.hint}</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {info.placeholders.map((p) => (
              <button
                key={p.key}
                type="button"
                className="chip h-6 px-2 py-0 font-mono text-[11px]"
                title={p.label}
                onClick={() => insert(p.key)}
              >
                {`{${p.key}}`}
              </button>
            ))}
          </div>
          <AutoTextarea
            ref={textareaRef}
            value={draft}
            onChange={setDraft}
            minRows={8}
            className="field font-mono text-xs"
            aria-label={`Texto do aviso ${info.title}`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!dirty} onClick={save}>
              Salvar texto
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={isDefault && !dirty}
              onClick={() => {
                setDraft(fallback)
                if (!isDefault) {
                  setMessageTemplate(kind, '')
                  toast(`${info.title}: texto padrão restaurado`)
                }
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden /> Restaurar padrão
            </button>
            <span className="ml-auto text-xs text-muted-foreground">
              {draft.length}/{TEMPLATE_MAX_LENGTH}
            </span>
          </div>
          {missing.length ? (
            <p className="mt-2 text-xs text-danger">
              Sem {missing.join(' e ')} no texto. Vale conferir se foi de propósito.
            </p>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Prévia com dados reais do painel. Placeholder vazio some junto com a linha dele.
          </p>
          <pre
            aria-label="Prévia da mensagem"
            className="whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-border bg-surface-2 px-3.5 py-3 font-sans text-sm leading-relaxed"
          >
            {preview}
          </pre>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Formatação do WhatsApp: *negrito*, _itálico_, ~riscado~. Vale para todo o time.
      </p>
    </div>
  )
}
