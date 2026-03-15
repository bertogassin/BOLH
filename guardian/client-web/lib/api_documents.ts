import { API_BASE, api, getToken } from './api_client'

export type Document = {
  id: string
  user_id: string
  user_type: string
  doc_type: string
  title: string
  description?: string
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
  updated_at: string
  expires_at?: string
  status: string
  tags: string[]
  version: number
  parent_id?: string
  signature?: string
  signature_date?: string
  signed_by?: string
  ocr_text?: string
  thumbnail_path?: string
  is_favorite: boolean
}

const DOCS_CACHE_TTL_MS = 15000

type DocumentsCacheEntry = {
  at: number
  data: Document[]
}

const documentsCache = new Map<string, DocumentsCacheEntry>()

function docsCacheKey(params?: { doc_type?: string; status?: string }): string {
  return `${params?.doc_type || '*'}|${params?.status || '*'}`
}

function readDocumentsCache(key: string): Document[] | null {
  if (typeof window === 'undefined') return null
  const entry = documentsCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > DOCS_CACHE_TTL_MS) {
    documentsCache.delete(key)
    return null
  }
  return entry.data
}

function writeDocumentsCache(key: string, data: Document[]): void {
  if (typeof window === 'undefined') return
  documentsCache.set(key, { at: Date.now(), data })
}

function clearDocumentsCache(): void {
  documentsCache.clear()
}

export async function fetchDocuments(params?: { doc_type?: string; status?: string }): Promise<Document[]> {
  const cacheKey = docsCacheKey(params)
  const cached = readDocumentsCache(cacheKey)
  if (cached) return cached
  const q = new URLSearchParams()
  if (params?.doc_type) q.set('doc_type', params.doc_type)
  if (params?.status) q.set('status', params.status)
  const data = await api<{ documents: Document[] }>(`/api/v1/documents?${q}`)
  const docs = Array.isArray(data.documents) ? data.documents : []
  writeDocumentsCache(cacheKey, docs)
  return docs
}

export async function fetchDocument(id: string): Promise<Document> {
  return api<Document>(`/api/v1/documents/${id}`)
}

export async function uploadDocument(file: File, docType?: string): Promise<{ id: string; document: Document }> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)
  form.append('doc_type', docType || 'document')
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/api/v1/documents/upload`, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
  clearDocumentsCache()
  return data as { id: string; document: Document }
}

export async function signDocument(id: string, signature: string): Promise<{ status: string }> {
  const result = await api<{ status: string }>(`/api/v1/documents/${id}/sign`, {
    method: 'POST',
    body: JSON.stringify({ signature }),
  })
  clearDocumentsCache()
  return result
}

export async function deleteDocument(id: string): Promise<void> {
  await api(`/api/v1/documents/${id}`, { method: 'DELETE' })
  clearDocumentsCache()
}

/** Returns the URL to download document file (use with fetch + Authorization for blob download). */
export function getDocumentFileUrl(id: string): string {
  return `${API_BASE}/api/v1/documents/${id}/file`
}

