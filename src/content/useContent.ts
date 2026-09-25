import { useCallback } from 'react'
import { getProfile } from '../lib/actor'
import { todayIso } from '../lib/dates'
import type { LaunchState } from '../data/types'
import type { ActivityInput } from '../store/activity'
import { load, mutate, newId, useLaunchState } from '../store/launchStore'
import {
  LIMITS,
  addCard,
  addColumn,
  blankCard,
  defaultContent,
  duplicateCard,
  moveCard,
  moveColumn,
  patchCard,
  patchColumn,
  removeCampaign,
  removeCard,
  removeColumn,
  upsertCampaign,
  withApprovalFor,
  withPublishedFor,
  type Attachment,
  type Campaign,
  type ContentCard,
  type ContentColumn,
  type ContentState,
  type Strategy,
} from './model'

const EMPTY = defaultContent()

export function contentOf(s: LaunchState): ContentState {
  return s.content ?? EMPTY
}

export function useContent(): ContentState {
  return contentOf(useLaunchState())
}

function withContent(fn: (c: ContentState) => ContentState) {
  return (s: LaunchState): LaunchState => {
    const before = contentOf(s)
    const after = fn(before)
    return after === before ? s : { ...s, content: after }
  }
}

function findCard(cardId: string): ContentCard | undefined {
  return contentOf(load()).cards.find((k) => k.id === cardId)
}

/** Depois de criar ou mover: rodada de aprovação e data de publicação acompanham a coluna. */
const settle = (c: ContentState, cardId: string) =>
  withPublishedFor(withApprovalFor(c, cardId, new Date().toISOString()), cardId, todayIso())

const who = () => getProfile().name
const cardEvent = (
  card: Pick<ContentCard, 'id' | 'title'>,
  action: ActivityInput['action'],
  details?: Record<string, unknown>,
): ActivityInput => ({
  action,
  entityType: 'card',
  entityId: card.id,
  entityLabel: card.title || 'Card sem título',
  ...(details ? { details } : {}),
})

/** Campos de texto que só geram uma linha no histórico (o servidor agrupa por 10 minutos). */
type CardPatch = Partial<Omit<ContentCard, 'id' | 'comments' | 'ownerIds' | 'columnId'>>

export function useContentActions() {
  const createCard = useCallback(
    (columnId: string, title: string, extra: Partial<ContentCard> = {}, atStart = false) => {
      const card: ContentCard = {
        ...blankCard(newId('k'), columnId, who()),
        ...extra,
        title: title.trim().slice(0, LIMITS.title),
      }
      const col = contentOf(load()).columns.find((c) => c.id === columnId)
      mutate(
        withContent((c) => settle(addCard(c, card, atStart), card.id)),
        cardEvent(card, 'card.add', { column: col?.name ?? '' }),
      )
      return card.id
    },
    [],
  )

  const updateCard = useCallback((cardId: string, patch: CardPatch) => {
    const before = findCard(cardId)
    if (!before) return
    const dateChanged =
      (patch.publishAt !== undefined && patch.publishAt !== before.publishAt) ||
      (patch.due !== undefined && patch.due !== before.due)
    const event = dateChanged
      ? cardEvent(before, 'card.date', {
          publishAt: patch.publishAt ?? before.publishAt,
          due: patch.due ?? before.due,
        })
      : cardEvent({ ...before, title: patch.title ?? before.title }, 'card.update', {
          fields: Object.keys(patch),
        })
    mutate(
      withContent((c) => patchCard(c, cardId, patch)),
      event,
    )
  }, [])

  const setOwners = useCallback((cardId: string, ids: string[]) => {
    const s0 = load()
    const before = findCard(cardId)
    if (!before) return
    const clean = [...new Set(ids.filter((id) => s0.people.some((p) => p.id === id)))]
    const added = clean.filter((id) => !before.ownerIds.includes(id))
    mutate(
      withContent((c) => patchCard(c, cardId, { ownerIds: clean })),
      cardEvent(before, 'card.owner', {
        ownerIds: clean,
        added,
        due: before.due,
        publishAt: before.publishAt,
      }),
    )
  }, [])

  const toggleLabel = useCallback((cardId: string, labelId: string) => {
    const before = findCard(cardId)
    if (!before) return
    const has = before.labelIds.includes(labelId)
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        if (!k) return c
        return patchCard(c, cardId, {
          labelIds: has ? k.labelIds.filter((l) => l !== labelId) : [...k.labelIds, labelId],
        })
      }),
      cardEvent(before, 'card.update', { fields: ['labelIds'] }),
    )
  }, [])

  const move = useCallback((cardId: string, toColumnId: string, toIndex: number) => {
    const s0 = contentOf(load())
    const before = s0.cards.find((k) => k.id === cardId)
    if (!before) return
    const from = s0.columns.find((c) => c.id === before.columnId)
    const to = s0.columns.find((c) => c.id === toColumnId)
    const changedColumn = before.columnId !== toColumnId
    mutate(
      withContent((c) => settle(moveCard(c, cardId, toColumnId, toIndex), cardId)),
      changedColumn
        ? cardEvent(before, 'card.move', {
            from: from?.name ?? '',
            to: to?.name ?? '',
            toStage: to?.stage ?? '',
            // o servidor avisa o cliente dos cards que entraram numa coluna de aprovação
            toApproval: !!to?.clientApproves && !from?.clientApproves,
          })
        : undefined,
    )
  }, [])

  const remove = useCallback((cardId: string) => {
    const before = findCard(cardId)
    if (!before) return
    mutate(
      withContent((c) => removeCard(c, cardId)),
      cardEvent(before, 'card.remove'),
    )
  }, [])

  const duplicate = useCallback((cardId: string) => {
    const before = findCard(cardId)
    if (!before) return ''
    const id = newId('k')
    mutate(
      withContent((c) => duplicateCard(c, cardId, id, who())),
      cardEvent({ id, title: `${before.title} (cópia)` }, 'card.add', { copyOf: cardId }),
    )
    return id
  }, [])

  // ---------- checklist ----------

  const addCheck = useCallback((cardId: string, text: string) => {
    const t = text.trim().slice(0, LIMITS.shortText)
    const before = findCard(cardId)
    if (!t || !before || before.checklist.length >= LIMITS.checklist) return
    const item = { id: newId('ck'), text: t, done: false }
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        return k ? patchCard(c, cardId, { checklist: [...k.checklist, item] }) : c
      }),
      cardEvent(before, 'card.update', { fields: ['checklist'] }),
    )
  }, [])

  const patchCheck = useCallback(
    (cardId: string, itemId: string, patch: { text?: string; done?: boolean }) => {
      const before = findCard(cardId)
      if (!before) return
      mutate(
        withContent((c) => {
          const k = c.cards.find((x) => x.id === cardId)
          if (!k) return c
          return patchCard(c, cardId, {
            checklist: k.checklist.map((x) =>
              x.id === itemId
                ? {
                    ...x,
                    ...(patch.text !== undefined
                      ? { text: patch.text.slice(0, LIMITS.shortText) }
                      : {}),
                    ...(patch.done !== undefined ? { done: patch.done } : {}),
                  }
                : x,
            ),
          })
        }),
        cardEvent(before, 'card.update', { fields: ['checklist'] }),
      )
    },
    [],
  )

  const removeCheck = useCallback((cardId: string, itemId: string) => {
    const before = findCard(cardId)
    if (!before) return
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        return k
          ? patchCard(c, cardId, { checklist: k.checklist.filter((x) => x.id !== itemId) })
          : c
      }),
      cardEvent(before, 'card.update', { fields: ['checklist'] }),
    )
  }, [])

  // ---------- comentários ----------

  const addComment = useCallback((cardId: string, text: string, authorId: string) => {
    const t = text.trim().slice(0, LIMITS.comment)
    const before = findCard(cardId)
    if (!t || !before) return
    const comment = {
      id: newId('cm'),
      authorId,
      authorName: who(),
      text: t,
      at: new Date().toISOString(),
      kind: 'comentario' as const,
    }
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        return k
          ? patchCard(c, cardId, { comments: [...k.comments, comment].slice(-LIMITS.comments) })
          : c
      }),
      cardEvent(before, 'card.comment', { commentId: comment.id, text: t.slice(0, 300) }),
    )
  }, [])

  const removeComment = useCallback((cardId: string, commentId: string) => {
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        return k
          ? patchCard(c, cardId, { comments: k.comments.filter((x) => x.id !== commentId) })
          : c
      }),
    )
  }, [])

  // ---------- anexos e links ----------

  const addAttachment = useCallback((cardId: string, att: Attachment) => {
    const before = findCard(cardId)
    if (!before) return
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        if (!k || k.attachments.length >= LIMITS.attachments) return c
        const isImage = att.mime.startsWith('image/') || att.mime.startsWith('video/')
        return patchCard(c, cardId, {
          attachments: [...k.attachments, att],
          // o primeiro arquivo visual vira capa sozinho
          ...(k.coverId === '' && isImage ? { coverId: att.id } : {}),
        })
      }),
      cardEvent(before, 'card.attach', { name: att.name }),
    )
  }, [])

  const removeAttachment = useCallback((cardId: string, attId: string) => {
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        if (!k) return c
        return patchCard(c, cardId, {
          attachments: k.attachments.filter((a) => a.id !== attId),
          ...(k.coverId === attId ? { coverId: '' } : {}),
        })
      }),
    )
  }, [])

  const addLink = useCallback((cardId: string, url: string, label: string) => {
    const before = findCard(cardId)
    if (!before) return
    const link = {
      id: newId('ln'),
      url: url.trim().slice(0, 1000),
      label: label.trim().slice(0, 120),
    }
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        if (!k || k.links.length >= LIMITS.links) return c
        return patchCard(c, cardId, { links: [...k.links, link] })
      }),
      cardEvent(before, 'card.update', { fields: ['links'] }),
    )
  }, [])

  const removeLink = useCallback((cardId: string, linkId: string) => {
    mutate(
      withContent((c) => {
        const k = c.cards.find((x) => x.id === cardId)
        return k ? patchCard(c, cardId, { links: k.links.filter((l) => l.id !== linkId) }) : c
      }),
    )
  }, [])

  // ---------- colunas ----------

  const createColumn = useCallback((name: string) => {
    const col: ContentColumn = {
      id: newId('col'),
      name: name.trim().slice(0, 60) || 'Nova coluna',
      color: 'gray',
      stage: 'custom',
      clientApproves: false,
    }
    mutate(
      withContent((c) => addColumn(c, col)),
      { action: 'column.add', entityType: 'column', entityId: col.id, entityLabel: col.name },
    )
  }, [])

  const updateColumn = useCallback(
    (columnId: string, patch: Partial<Omit<ContentColumn, 'id'>>) => {
      const col = contentOf(load()).columns.find((c) => c.id === columnId)
      if (!col) return
      mutate(
        withContent((c) => patchColumn(c, columnId, patch)),
        {
          action: 'column.update',
          entityType: 'column',
          entityId: columnId,
          entityLabel: patch.name ?? col.name,
        },
      )
    },
    [],
  )

  const shiftColumn = useCallback((columnId: string, delta: -1 | 1) => {
    mutate(withContent((c) => moveColumn(c, columnId, delta)))
  }, [])

  const deleteColumn = useCallback((columnId: string) => {
    const col = contentOf(load()).columns.find((c) => c.id === columnId)
    if (!col) return
    mutate(
      withContent((c) => removeColumn(c, columnId)),
      { action: 'column.remove', entityType: 'column', entityId: columnId, entityLabel: col.name },
    )
  }, [])

  // ---------- campanhas ----------

  const saveCampaign = useCallback((campaign: Campaign) => {
    const exists = contentOf(load()).campaigns.some((x) => x.id === campaign.id)
    mutate(
      withContent((c) => upsertCampaign(c, campaign)),
      {
        action: exists ? 'campaign.update' : 'campaign.add',
        entityType: 'campaign',
        entityId: campaign.id,
        entityLabel: campaign.name,
      },
    )
  }, [])

  const deleteCampaign = useCallback((campaignId: string) => {
    const campaign = contentOf(load()).campaigns.find((x) => x.id === campaignId)
    if (!campaign) return
    mutate(
      withContent((c) => removeCampaign(c, campaignId)),
      {
        action: 'campaign.remove',
        entityType: 'campaign',
        entityId: campaignId,
        entityLabel: campaign.name,
      },
    )
  }, [])

  // ---------- estratégia ----------

  const updateStrategy = useCallback((patch: Partial<Strategy>, section: string) => {
    mutate(
      withContent((c) => ({ ...c, strategy: { ...c.strategy, ...patch } })),
      {
        action: 'strategy.update',
        entityType: 'strategy',
        entityId: section,
        entityLabel: section,
      },
    )
  }, [])

  return {
    createCard,
    updateCard,
    setOwners,
    toggleLabel,
    move,
    remove,
    duplicate,
    addCheck,
    patchCheck,
    removeCheck,
    addComment,
    removeComment,
    addAttachment,
    removeAttachment,
    addLink,
    removeLink,
    createColumn,
    updateColumn,
    shiftColumn,
    deleteColumn,
    saveCampaign,
    deleteCampaign,
    updateStrategy,
  }
}
