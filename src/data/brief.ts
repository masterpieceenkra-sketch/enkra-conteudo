export type FieldKind = 'short' | 'long' | 'number'

export interface BriefField {
  id: string
  label: string
  kind?: FieldKind
  hint?: string
}

export interface BriefSection {
  id: string
  title: string
  description?: string
  fields: BriefField[]
}

/**
 * Brief do lançamento em 10 blocos, organizados por área (estrutura definida em 18/09/2026).
 * Ids antigos foram mantidos onde o significado é o mesmo, para não perder o que já foi digitado.
 * Datas de fases e marcos ficam na página Calendário.
 */
export const BRIEF_SECTIONS: BriefSection[] = [
  {
    id: 'narrativa',
    title: 'Narrativa do Evento',
    fields: [
      { id: 'especialista', label: 'Especialista' },
      {
        id: 'nomeEvento',
        label: 'Nome do evento',
        hint: 'Como vai ser chamado no grupo, na página e internamente.',
      },
      {
        id: 'narrativaOcasiao',
        label: 'Narrativa da ocasião',
        hint: 'A desculpa legítima da temporada: aniversário, data comemorativa, marco do expert.',
        kind: 'long',
      },
      { id: 'bigIdea', label: 'Big Idea / promessa em 1 frase', kind: 'long' },
      {
        id: 'persona',
        label: 'Persona do evento',
        hint: 'Quem é, o que dói, o que objeta.',
        kind: 'long',
      },
      {
        id: 'baseTemperatura',
        label: 'Base fria ou quente?',
        hint: 'O lead captado conhece o expert?',
      },
      {
        id: 'compliance',
        label: 'Compliance',
        hint: 'O que não pode ser dito ou prometido nesse nicho, e os números de prova permitidos.',
        kind: 'long',
      },
    ],
  },
  {
    id: 'oferta',
    title: 'Produto & Oferta',
    fields: [
      { id: 'prodNome', label: 'Nome do produto' },
      { id: 'puv', label: 'PUV (proposta única de valor)', kind: 'long' },
      {
        id: 'composicao',
        label: 'O que será vendido',
        hint: 'Produto único ou combo, com a composição exata.',
        kind: 'long',
      },
      {
        id: 'ancora',
        label: 'Âncora (preço cheio)',
        hint: 'Soma honesta dos itens vendidos separadamente.',
      },
      {
        id: 'prodPreco',
        label: 'Preço do evento',
        hint: 'À vista + parcelamento (12x de R$ X) + % de desconto.',
      },
      { id: 'prodPagamento', label: 'Formas de pagamento' },
      { id: 'acesso', label: 'Acesso', hint: 'Vitalício ou por prazo.' },
      { id: 'prodGarantia', label: 'Garantia', hint: 'Dias e tipo.' },
      {
        id: 'bonusIncondicional',
        label: 'Bônus incondicional',
        hint: 'O que todo comprador leva.',
        kind: 'long',
      },
      {
        id: 'prodBonus',
        label: 'Escada de bônus',
        hint: 'X primeiros (bônus ouro) · até 12h do dia (relâmpago).',
        kind: 'long',
      },
      { id: 'orderBump', label: 'Order bump', hint: 'Item e valor no checkout.' },
      { id: 'upNome', label: 'Upsell', hint: 'Item e valor. Ou "não vai ter".' },
      {
        id: 'downNome',
        label: 'Downsell',
        hint: 'O que entra se não comprar o principal. Ou "não vai ter".',
      },
      {
        id: 'checkout',
        label: 'Plataforma de checkout',
        hint: 'Ex.: Hotmart, Kiwify. Quem configura.',
      },
    ],
  },
  {
    id: 'metas',
    title: 'Metas e Projeções',
    description: 'Os números que o time se compromete. A conta do funil sai daqui.',
    fields: [
      { id: 'leadsOrganicos', label: 'Meta de leads orgânico', kind: 'number' },
      { id: 'leadsPagos', label: 'Meta de leads pago', kind: 'number' },
      { id: 'leadsBase', label: 'Meta de leads da base (disparo)', kind: 'number' },
      { id: 'metaFaturamento', label: 'Meta de faturamento (R$)', kind: 'number' },
      { id: 'investimento', label: 'Verba de tráfego (R$)', kind: 'number' },
      {
        id: 'premissasFunil',
        label: 'Premissas do funil',
        hint: 'CPL alvo · CTR · connect rate · conversão da página · show up · taxa de entrada no grupo.',
        kind: 'long',
      },
      { id: 'taxaConversao', label: 'Conversão de vendas esperada (%)', kind: 'number' },
      {
        id: 'ticketAov',
        label: 'Ticket e AOV',
        hint: 'Preço do evento + bump e upsell com taxa de aceitação, se estimado.',
      },
      {
        id: 'custoDisparo',
        label: 'Custo de disparo',
        hint: 'Custo por mensagem × tamanho da base × número de rodadas.',
      },
      {
        id: 'custosExtras',
        label: 'Custos extras',
        hint: 'Ferramentas, operadores, brindes, produção. Tudo que não é tráfego nem disparo.',
        kind: 'long',
      },
      { id: 'planilhaProjecao', label: 'Planilha de projeção', hint: 'Link.' },
    ],
  },
  {
    id: 'abertura',
    title: 'Live de Abertura',
    fields: [
      { id: 'liveData', label: 'Data da live de abertura' },
      { id: 'liveCanal', label: 'Canal da live', hint: 'Instagram, YouTube, Zoom…' },
      { id: 'liveHorario', label: 'Horário da live' },
      { id: 'liveTema', label: 'Tema da live', kind: 'long' },
    ],
  },
  {
    id: 'organico',
    title: 'Instagram orgânico',
    fields: [
      { id: 'igOrganicoQuem', label: 'Quem posta?' },
      {
        id: 'igOrganicoCadencia',
        label: 'Frequência',
        hint: 'Ex.: 1 story por dia + 2 reels na semana.',
      },
      { id: 'manychatVai', label: 'Vai usar ManyChat?', hint: 'Se sim, qual palavra-chave.' },
      {
        id: 'igFormatos',
        label: 'Quais formatos e linhas de conteúdo?',
        hint: 'Reels, stories, carrossel, collab; bastidor, prova, convite…',
        kind: 'long',
      },
      { id: 'igTeaser', label: 'Vai ter vídeo teaser? Se sim, qual data?' },
    ],
  },
  {
    id: 'pago',
    title: 'Tráfego Pago',
    fields: [
      { id: 'igPagoVai', label: 'Vai rodar tráfego pago?' },
      {
        id: 'igPagoVerba',
        label: 'Qual a verba disponível e proporção?',
        hint: 'Ex.: R$ 10 mil, 70% captação e 30% remarketing/carrinho.',
      },
      {
        id: 'igPagoCriativos',
        label: 'Os criativos já existem?',
        hint: 'Ou serão criados. Quantos.',
      },
      { id: 'igPagoPlataformas', label: 'Quais plataformas?', hint: 'Meta, Google, TikTok…' },
      { id: 'utms', label: 'Quais UTMs?', hint: 'Padrão de nomenclatura ou link da planilha.' },
      { id: 'criativosDrive', label: 'Pasta do Drive dos criativos', hint: 'Link.' },
      { id: 'criativosPlanilha', label: 'Planilha de catalogação', hint: 'Link.' },
    ],
  },
  {
    id: 'whatsapp',
    title: 'Grupos de WhatsApp',
    description: 'Os números dos admins alimentam o link verificador oficial, logo abaixo.',
    fields: [
      { id: 'grupoQtd', label: 'Quantos grupos?', kind: 'number' },
      { id: 'grupoLimite', label: 'Limite de pessoas por grupo', kind: 'number' },
      { id: 'grupoAberturaData', label: 'Quando o grupo abre para entrada?' },
      { id: 'grupoFechamentoData', label: 'Quando o grupo fecha para entrada?' },
      { id: 'grupoPerguntasData', label: 'Quando o grupo abre para perguntas?' },
      {
        id: 'grupoAberturaHorarios',
        label: 'Em quais horários o grupo abre?',
        hint: 'Janelas de conversa/dúvidas. Ex.: 9h às 12h e 14h às 17h.',
      },
      { id: 'grupoFerramenta', label: 'Ferramenta de gestão?', hint: 'Ex.: SendFlow.' },
      { id: 'grupoOperadores', label: 'Quantos operadores?', kind: 'number' },
      {
        id: 'adminNumeros',
        label: 'Números dos admins',
        hint: 'Um por linha, com DDD. Ex.: +55 85 99999-0000 · Nome. São os números oficiais do anti-golpe.',
        kind: 'long',
      },
      { id: 'grupoMensagensInicio', label: 'Quando inicia a data das mensagens?' },
      { id: 'grupoCronogramaLink', label: 'Link do doc de cronograma de mensagens' },
    ],
  },
  {
    id: 'disparo',
    title: 'Disparos',
    fields: [
      {
        id: 'baseQual',
        label: 'Vai disparar para qual base e quantos leads?',
        hint: 'Ex.: compradores antigos (3.000), leads do último lançamento (12.000).',
        kind: 'long',
      },
      {
        id: 'disparoVai',
        label: 'Qual provedor de disparo?',
        hint: 'API oficial? Qual ferramenta.',
      },
      {
        id: 'disparoMomento',
        label: 'Em que momento vai ser disparado?',
        hint: 'Rodadas: convite, lembrete da live, abertura do carrinho, aviso de fechamento.',
        kind: 'long',
      },
      {
        id: 'custoDisparo',
        label: 'Custo de disparo',
        hint: 'Mesmo campo de Metas e Projeções.',
      },
      { id: 'disparoResponsavel', label: 'Responsável' },
    ],
  },
  {
    id: 'links',
    title: 'Páginas e Links',
    fields: [
      {
        id: 'driveProjeto',
        label: 'Qual é o drive do projeto?',
        hint: 'Link da pasta principal no Google Drive.',
      },
      {
        id: 'planejamentoLink',
        label: 'Planejamento existente',
        hint: 'Mapa mental ou doc já feito, se houver (link).',
      },
      { id: 'brandingBook', label: 'Branding book' },
      {
        id: 'depoimentos',
        label: 'Pasta de depoimentos',
        hint: 'Prints, áudios e vídeos (link) e o que já está tarjado.',
      },
      { id: 'capturaUrl', label: 'URL da página de captura' },
      { id: 'obrigadoUrl', label: 'URL da página de obrigado' },
      { id: 'vendasUrl', label: 'URL da página de vendas' },
      { id: 'checkoutUrl', label: 'URL do checkout da oferta' },
    ],
  },
  {
    id: 'time',
    title: 'Time Escalado',
    description:
      'Quem responde por cada frente. Os nomes aparecem como sugestão de responsável no checklist.',
    fields: [
      { id: 'timeEstrategista', label: 'Estrategista' },
      { id: 'timeExpert', label: 'Expert' },
      { id: 'timeCopy', label: 'Copy' },
      { id: 'timeTrafego', label: 'Tráfego' },
      { id: 'timeDesign', label: 'Design' },
      { id: 'timeVideo', label: 'Filmmaker / edição' },
      { id: 'timeWeb', label: 'Dev / web' },
      { id: 'timeOps', label: 'Infra / grupos' },
      { id: 'timeSuporte', label: 'Suporte' },
      { id: 'timeRecuperador', label: 'Comercial / recuperação' },
      { id: 'timeSocial', label: 'Social media' },
      { id: 'timeEducacional', label: 'Educacional' },
    ],
  },
]

export const BRIEF_FIELD_IDS = [
  ...new Set(BRIEF_SECTIONS.flatMap((s) => s.fields.map((f) => f.id))),
]

/** IDs dos campos do time — usados como sugestão de responsável no checklist. */
export const TEAM_FIELD_IDS = [
  'especialista',
  ...BRIEF_SECTIONS.find((s) => s.id === 'time')!.fields.map((f) => f.id),
]
