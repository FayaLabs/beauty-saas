import React, { useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileText, Image, Paperclip } from 'lucide-react'
import { Badge, Card, CardContent } from '@fayz-ai/ui'
import { getActiveTenantId, getSupabaseClientOptional, type EntityDef } from '@fayz-ai/saas'
import { tl } from '../../i18n/tl'

type ClientDocumentKind = 'form' | 'image' | 'attachment' | 'contract' | 'prescription' | string

interface ClientDocument {
  id: string
  title?: string
  templateName?: string
  kind?: ClientDocumentKind
  status?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  createdAt?: string
  updatedAt?: string
}

const statusLabels: Record<string, string> = {
  draft: tl('Draft', 'Rascunho'),
  completed: tl('Completed', 'Finalizado'),
  signed: tl('Signed', 'Assinado'),
  archived: tl('Archived', 'Arquivado'),
}

const kindLabels: Record<string, string> = {
  form: tl('Form', 'Formulario'),
  image: tl('Image', 'Imagem'),
  attachment: tl('Attachment', 'Anexo'),
  contract: tl('Contract', 'Contrato'),
  prescription: tl('Prescription', 'Prescricao'),
}

function formatDate(value?: string): string {
  if (!value) return tl('No date', 'Sem data')
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatFileSize(value?: number): string | undefined {
  if (!value) return undefined
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function documentIcon(kind?: string) {
  switch (kind) {
    case 'image':
      return Image
    case 'attachment':
      return Paperclip
    default:
      return FileText
  }
}

async function loadClientDocuments(clientId: string): Promise<ClientDocument[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let query = supabase
    .from('v_documents')
    .select('id, title, template_name, kind, status, file_url, file_name, file_size, created_at, updated_at')
    .eq('person_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(24)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    title: row.title ?? undefined,
    templateName: row.template_name ?? undefined,
    kind: row.kind ?? undefined,
    status: row.status ?? undefined,
    fileUrl: row.file_url ?? undefined,
    fileName: row.file_name ?? undefined,
    fileSize: typeof row.file_size === 'number' ? row.file_size : Number(row.file_size) || undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }))
}

export function ClientDocumentsTab({
  item,
  loadingLabel = tl('Loading client documents...', 'Carregando documentos do cliente...'),
  emptyLabel = tl('No documents, images or attachments found for this client yet.', 'Nenhum documento, imagem ou anexo encontrado para este cliente ainda.'),
}: {
  item: unknown
  entityDef: EntityDef
  loadingLabel?: string
  emptyLabel?: string
}) {
  const person = item as Record<string, unknown>
  const personId = String(person.id ?? person.personId ?? '')
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const next = personId ? await loadClientDocuments(personId) : []
        if (mounted) setDocuments(next)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [personId])

  const emptyMessage = useMemo(() => {
    if (loading) return loadingLabel
    return emptyLabel
  }, [emptyLabel, loading, loadingLabel])

  if (loading || documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const Icon = documentIcon(doc.kind)
        const title = doc.title ?? doc.templateName ?? doc.fileName ?? tl('Document', 'Documento')
        const kind = doc.kind ? (kindLabels[doc.kind] ?? doc.kind) : undefined
        const status = doc.status ? (statusLabels[doc.status] ?? doc.status) : undefined
        const meta = [doc.fileName, formatFileSize(doc.fileSize)].filter(Boolean).join(' · ')

        return (
          <Card key={doc.id}>
            <CardContent className="flex gap-4 p-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
                  {kind && <Badge variant="secondary">{kind}</Badge>}
                  {status && <Badge variant="outline">{status}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(doc.createdAt ?? doc.updatedAt)}</p>
                {meta && <p className="mt-2 truncate text-sm text-muted-foreground">{meta}</p>}
              </div>
              {doc.fileUrl && (
                <button
                  type="button"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={tl('Open file', 'Abrir arquivo')}
                  onClick={() => window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
