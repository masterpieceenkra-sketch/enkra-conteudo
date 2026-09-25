import { useEffect, useState } from 'react'
import { LAUNCH_ID, supabase } from '../lib/supabase'
import { newId } from '../store/launchStore'
import { MAX_ATTACHMENT_BYTES, formatBytes, type Attachment } from './model'

/**
 * Anexos dos cards: arquivos no bucket privado `content-attachments`, em
 * `<quadro>/<card>/<id>-<nome>`. A política do bucket só deixa ler e gravar quem está no
 * cadastro do quadro. O estado guarda o caminho; a URL é assinada na hora de mostrar.
 */
export const BUCKET = 'content-attachments'

const SIGNED_TTL_S = 60 * 60
const cache = new Map<string, { url: string; until: number }>()
const inflight = new Map<string, Promise<string>>()

/** Nome seguro para o caminho (o nome original continua no anexo, para mostrar). */
function safeName(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80)
  return clean || 'arquivo'
}

export async function uploadAttachment(cardId: string, file: File): Promise<Attachment> {
  if (file.size > MAX_ATTACHMENT_BYTES)
    throw new Error(
      `${file.name} tem ${formatBytes(file.size)}. O limite é ${formatBytes(MAX_ATTACHMENT_BYTES)}: para vídeo pesado, cole o link do Drive.`,
    )
  const sb = supabase()
  if (!sb) throw new Error('Anexo precisa do servidor (modo local não guarda arquivo).')
  const id = newId('at')
  const path = `${LAUNCH_ID}/${cardId}/${id}-${safeName(file.name)}`
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return {
    id,
    path,
    name: file.name.slice(0, 200),
    size: file.size,
    mime: file.type.slice(0, 120),
  }
}

/** Apaga o arquivo do bucket. Falha aqui não impede tirar o anexo do card. */
export async function deleteAttachmentFile(path: string): Promise<void> {
  const sb = supabase()
  if (!sb) return
  cache.delete(path)
  await sb.storage.from(BUCKET).remove([path])
}

export async function signedUrl(path: string): Promise<string> {
  const hit = cache.get(path)
  if (hit && hit.until > Date.now()) return hit.url
  const running = inflight.get(path)
  if (running) return running
  const sb = supabase()
  if (!sb) return ''
  const p = (async () => {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL_S)
    inflight.delete(path)
    if (error || !data?.signedUrl) return ''
    // renova um pouco antes de expirar
    cache.set(path, { url: data.signedUrl, until: Date.now() + (SIGNED_TTL_S - 120) * 1000 })
    return data.signedUrl
  })()
  inflight.set(path, p)
  return p
}

/** URL assinada de um anexo (vazia enquanto carrega ou sem acesso). */
export function useSignedUrl(path: string | undefined): string {
  const [got, setGot] = useState<{ path: string; url: string } | null>(null)
  useEffect(() => {
    if (!path) return
    let cancelled = false
    void signedUrl(path).then((url) => {
      if (!cancelled) setGot({ path, url })
    })
    return () => {
      cancelled = true
    }
  }, [path])
  return got && got.path === path ? got.url : ''
}

export const isImage = (a: Pick<Attachment, 'mime'>) => a.mime.startsWith('image/')
export const isVideo = (a: Pick<Attachment, 'mime'>) => a.mime.startsWith('video/')
