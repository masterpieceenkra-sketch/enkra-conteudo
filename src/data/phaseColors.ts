/**
 * Cor de cada fase na linha do tempo e no calendário.
 * Tons da paleta Comu (azul, verde-água, pink, lima) com variações claras para 8 fases.
 * Funciona igual no tema claro e no escuro; o texto sobre a cor é escolhido por luminância.
 */
export interface PhaseColor {
  bg: string
  fg: string
}

const PALETTE: PhaseColor[] = [
  { bg: '#8a8580', fg: '#ffffff' }, // f0 backlog: cinza quente
  { bg: '#3a39ff', fg: '#ffffff' }, // f1 azul
  { bg: '#00c8c7', fg: '#000000' }, // f2 verde-água
  { bg: '#f10064', fg: '#ffffff' }, // f3 pink
  { bg: '#cfe600', fg: '#000000' }, // f4 lima
  { bg: '#8584ff', fg: '#000000' }, // f5 azul claro
  { bg: '#ff6fa3', fg: '#000000' }, // f6 pink claro
  { bg: '#6fe3e0', fg: '#000000' }, // f7 verde-água claro
  { bg: '#e6f26b', fg: '#000000' }, // extra: lima claro
]

export function phaseColor(index: number): PhaseColor {
  return PALETTE[index % PALETTE.length]
}
