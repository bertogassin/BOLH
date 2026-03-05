'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchDocuments, getDocumentFileUrl, type Document } from '@/lib/api'
import { CATEGORIES, formatSize, isExpiringSoon } from './documentHubUtils'

export function useDocumentsHub(userId?: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all'
    return localStorage.getItem('dochub_category') || 'all'
  })
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('dochub_search') || ''
  })
  const [statusFilter, setStatusFilter] = useState<'all' | 'signed' | 'unsigned' | 'expiring'>(() => {
    if (typeof window === 'undefined') return 'all'
    const v = localStorage.getItem('dochub_status')
    return v === 'signed' || v === 'unsigned' || v === 'expiring' ? v : 'all'
  })
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'size_desc' | 'size_asc' | 'title'>(() => {
    if (typeof window === 'undefined') return 'updated'
    const v = localStorage.getItem('dochub_sort')
    return v === 'created' || v === 'size_desc' || v === 'size_asc' || v === 'title' ? v : 'updated'
  })
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list'
    return localStorage.getItem('dochub_view') === 'grid' ? 'grid' : 'list'
  })
  const [showOnlySelected, setShowOnlySelected] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [downloadingBulk, setDownloadingBulk] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [actionHintKey, setActionHintKey] = useState('')

  const loadDocuments = async () => {
    try {
      const docs = await fetchDocuments()
      setDocuments(Array.isArray(docs) ? docs : [])
    } catch {
      setDocuments([])
    }
  }

  useEffect(() => {
    if (!userId) return
    loadDocuments().finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hydrateSaved = () => {
      try {
        const raw = localStorage.getItem('dochub_saved_ids')
        const parsed = raw ? JSON.parse(raw) : []
        setSavedIds(Array.isArray(parsed) ? parsed : [])
      } catch {
        setSavedIds([])
      }
    }
    hydrateSaved()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dochub_saved_ids') hydrateSaved()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('dochub_category', category)
  }, [category])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('dochub_search', search)
  }, [search])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('dochub_status', statusFilter)
  }, [statusFilter])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('dochub_sort', sortBy)
  }, [sortBy])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('dochub_view', viewMode)
  }, [viewMode])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        const el = document.getElementById('dochub-search') as HTMLInputElement | null
        el?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!actionHintKey) return
    const timer = setTimeout(() => setActionHintKey(''), 1500)
    return () => clearTimeout(timer)
  }, [actionHintKey])

  const needSignature = useMemo(() => documents.filter((d) => d.status !== 'signed'), [documents])
  const cat = CATEGORIES.find((c) => c.id === category)
  const filteredDocs = documents.filter((d) => {
    if (category === 'saved' && !savedIds.includes(d.id)) return false
    if (cat?.docType && d.doc_type !== cat.docType) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        d.title?.toLowerCase().includes(q) ||
        d.file_name?.toLowerCase().includes(q) ||
        d.doc_type?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags?.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  const statusFilteredDocs = useMemo(() => {
    if (statusFilter === 'all') return filteredDocs
    if (statusFilter === 'signed') return filteredDocs.filter((d) => d.status === 'signed')
    if (statusFilter === 'unsigned') return filteredDocs.filter((d) => d.status !== 'signed')
    return filteredDocs.filter(isExpiringSoon)
  }, [filteredDocs, statusFilter])

  const orderedDocs = useMemo(() => {
    const next = [...statusFilteredDocs]
    if (sortBy === 'title') return next.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    if (sortBy === 'size_desc') return next.sort((a, b) => b.file_size - a.file_size)
    if (sortBy === 'size_asc') return next.sort((a, b) => a.file_size - b.file_size)
    if (sortBy === 'created') return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return next.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
  }, [statusFilteredDocs, sortBy])

  const visibleDocs = useMemo(
    () => (showOnlySelected ? orderedDocs.filter((d) => selectedIds.includes(d.id)) : orderedDocs),
    [orderedDocs, selectedIds, showOnlySelected]
  )
  const selectedDocs = useMemo(() => orderedDocs.filter((d) => selectedIds.includes(d.id)), [orderedDocs, selectedIds])
  const totalStorageBytes = useMemo(() => documents.reduce((sum, d) => sum + (d.file_size || 0), 0), [documents])
  const selectedSizeBytes = useMemo(() => selectedDocs.reduce((sum, d) => sum + (d.file_size || 0), 0), [selectedDocs])

  const refresh = async () => {
    setRefreshing(true)
    await loadDocuments()
    setActionHintKey('documents_hub.hint_list_refreshed')
    setRefreshing(false)
  }

  const toggleSelectDoc = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllVisible = () => {
    setSelectedIds(orderedDocs.map((d) => d.id))
  }

  const clearSelection = () => setSelectedIds([])

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setStatusFilter('all')
    setSortBy('updated')
    setShowOnlySelected(false)
  }

  const copySelectionSummary = async () => {
    if (selectedDocs.length === 0) return
    const text = selectedDocs.map((d) => `• ${d.title} (${d.doc_type}, ${formatSize(d.file_size)})`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setActionHintKey('documents_hub.hint_summary_copied')
    } catch {
      // ignore
    }
  }

  const copyDocumentLink = async (id: string) => {
    if (typeof window === 'undefined') return
    const link = `${window.location.origin}/documents/${id}`
    try {
      await navigator.clipboard.writeText(link)
      setActionHintKey('documents_hub.hint_link_copied')
    } catch {
      // ignore
    }
  }

  const downloadOne = async (doc: Document) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('guardian_token') : null
    const res = await fetch(getDocumentFileUrl(doc.id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.file_name || doc.title || 'document'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCsv = async () => {
    const source = selectedDocs.length > 0 ? selectedDocs : orderedDocs
    if (source.length === 0) return
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`
    const rows = [
      ['id', 'title', 'doc_type', 'status', 'size_bytes', 'created_at', 'updated_at', 'expires_at'],
      ...source.map((d) => [d.id, d.title || '', d.doc_type || '', d.status || '', String(d.file_size || 0), d.created_at || '', d.updated_at || '', d.expires_at || '']),
    ]
    const csv = rows.map((row) => row.map((cell) => escapeCell(cell)).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `document-hub-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setActionHintKey('documents_hub.hint_csv_exported')
  }

  const downloadSelected = async () => {
    if (selectedDocs.length === 0) return
    setDownloadingBulk(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('guardian_token') : null
      for (const d of selectedDocs) {
        try {
          const res = await fetch(getDocumentFileUrl(d.id), {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          if (!res.ok) continue
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = d.file_name || d.title || 'document'
          a.click()
          URL.revokeObjectURL(url)
        } catch {
          // continue
        }
      }
    } finally {
      setDownloadingBulk(false)
    }
  }

  return {
    documents,
    savedIds,
    loading,
    category,
    setCategory,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    showOnlySelected,
    setShowOnlySelected,
    selectedIds,
    downloadingBulk,
    refreshing,
    actionHintKey,
    needSignature,
    visibleDocs,
    selectedDocs,
    totalStorageBytes,
    selectedSizeBytes,
    refresh,
    toggleSelectDoc,
    selectAllVisible,
    clearSelection,
    clearFilters,
    copySelectionSummary,
    copyDocumentLink,
    downloadOne,
    exportCsv,
    downloadSelected,
  }
}

