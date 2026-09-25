import type { LaunchState, Meeting, Person } from '../data/types'
import { LAUNCH_ID, SUPABASE_KEY, SUPABASE_URL } from '../lib/supabase'
import { isValidIso, type IsoDate } from '../lib/dates'
import type { Profile } from '../lib/actor'
import { accessToken } from '../lib/auth'

/** Tarefa como a IA devolve (campos em português, iguais ao schema da edge function). */
export interface RawProposal {
  titulo?: unknown
  acao?: unknown
  responsavel?: unknown
  area?: unknown
  fase?: unknown
  prazo?: unknown
  checklist?: unknown
}

/** Card proposto, já resolvido contra o estado do painel e pronto para edição. */
export interface Proposal {
  key: string
  title: string
  description: string
  ownerName: string
  /** id de Person quando o nome casa com alguém do cadastro */
  ownerId: string
  phaseId: string
  /** id de Area existente na fase, ou `new:NOME` para criar */
  areaId: string
  due: string
  checklist: string[]
}

const norm = (s: string) =>
  s.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '')

/** Casa o nome citado na ata com alguém do cadastro: nome inteiro, ou primeiro nome sem ambiguidade. */
export function matchPerson(name: string, people: Person[]): Person | undefined {
  const n = norm(name)
  if (!n) return undefined
  const exact = people.find((p) => norm(p.name) === n)
  if (exact) return exact
  const first = n.split(/\s+/)[0]
  const byFirst = people.filter((p) => norm(p.name).split(/\s+/)[0] === first)
  return byFirst.length === 1 ? byFirst[0] : undefined
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Fase padrão quando a IA não escolheu: a que contém a data da reunião, senão a atual, senão a primeira. */
function defaultPhase(s: LaunchState, meetingDate: string, today: IsoDate): string {
  const byDate = s.phases.find((p) => p.start <= meetingDate && meetingDate <= p.end)
  const current = s.phases.find((p) => p.start <= today && today <= p.end)
  return (byDate ?? current ?? s.phases[0])?.id ?? ''
}

/** Resolve uma proposta crua da IA contra fases, áreas e pessoas do painel. */
export function resolveProposal(
  raw: RawProposal,
  index: number,
  s: LaunchState,
  meeting: Meeting,
  today: IsoDate,
): Proposal | null {
  const title = str(raw.titulo, 120)
  if (!title) return null
  const phaseId = s.phases.some((p) => p.id === raw.fase)
    ? (raw.fase as string)
    : defaultPhase(s, meeting.date, today)
  const phase = s.phases.find((p) => p.id === phaseId)
  const areaName = str(raw.area, 40).toUpperCase()
  const area = phase?.areas.find((a) => a.name.toUpperCase() === areaName)
  const areaId = area?.id ?? (areaName ? `new:${areaName}` : (phase?.areas[0]?.id ?? ''))
  const ownerName = str(raw.responsavel, 80)
  const person = ownerName ? matchPerson(ownerName, s.people) : undefined
  const due = str(raw.prazo, 10)
  const checklist = Array.isArray(raw.checklist)
    ? raw.checklist
        .map((c) => str(c, 200))
        .filter(Boolean)
        .slice(0, 30)
    : []
  return {
    key: `p${index}`,
    title,
    description: str(raw.acao, 2000),
    ownerName: person?.name ?? ownerName,
    ownerId: person?.id ?? '',
    phaseId,
    areaId,
    due: isValidIso(due) ? due : '',
    checklist,
  }
}

export interface ExtractResult {
  proposals: RawProposal[]
  usage: { input_tokens?: number; output_tokens?: number } | null
}

/** Chama a edge function que lê a ata e propõe cards. Lança erro com a mensagem para o usuário. */
export async function extractTasks(
  meeting: Meeting,
  s: LaunchState,
  today: IsoDate,
  actor: Profile,
): Promise<ExtractResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Servidor não configurado')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/comu-hub-extract-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken()}`,
      'x-comu-launch': LAUNCH_ID,
    },
    body: JSON.stringify({
      launchId: LAUNCH_ID,
      actor: actor.name,
      summary: meeting.summary ?? '',
      meetingTitle: meeting.title,
      meetingDate: meeting.date,
      today,
      people: s.people.map((p) => ({ id: p.id, name: p.name, role: p.role })),
      phases: s.phases.map((p) => ({
        id: p.id,
        name: p.name,
        start: p.start,
        end: p.end,
        areas: p.areas.map((a) => a.name),
      })),
    }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    tarefas?: RawProposal[]
    usage?: ExtractResult['usage']
  }
  if (!res.ok) throw new Error(body.error || `Falha ao identificar tarefas (${res.status})`)
  return { proposals: body.tarefas ?? [], usage: body.usage ?? null }
}
