import { createContext } from 'react'
import type { Person } from '../data/types'

/** Abre o card de detalhes de uma tarefa (montado uma vez na página do checklist). */
export type OpenTask = (taskId: string) => void

export const OpenTaskCtx = createContext<OpenTask>(() => {})

export function openTaskContext(set: (id: string | null) => void): OpenTask {
  return (id) => set(id)
}

/** Pessoas cadastradas, para o seletor de responsável nas linhas. */
export const PeopleCtx = createContext<Person[]>([])
