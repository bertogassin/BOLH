'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  Upload,
  Search,
  CheckSquare,
  Download,
  Copy,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpDown,
  Database,
  Grid2X2,
  List,
  X,
  Link2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { InputWithClear } from '@/components/InputWithClear'
import { BOLHNav } from '@/components/BOLHNav'
import { DocumentList } from './DocumentList'
import { CATEGORIES, formatSize } from './documentHubUtils'
import { useDocumentsHub } from './useDocumentsHub'

export default function DocumentsHubPage() {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const {
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
  } = useDocumentsHub(user?.id)

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-24">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/profile"
              className="mt-0.5 inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
              aria-label={t('back_home')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">{t('documents_hub.title')}</h1>
              <p className="text-sm text-white/50">
                {documents.length} {t('documents_hub.docs_short')}{' '}
                {needSignature.length > 0 ? `· ${needSignature.length} ${t('documents_hub.unsigned_short')}` : `· ${t('documents_hub.all_signed_short')}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-2 text-white/80"
              title={t('documents_hub.refresh_list')}
            >
              <RotateCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/documents/upload" className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 text-sm font-medium">
              <span className="inline-flex items-center gap-1.5"><Upload className="h-4 w-4" />{t('documents_hub.upload')}</span>
            </Link>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 z-10" />
            <InputWithClear
              id="dochub-search"
              value={search}
              onChange={setSearch}
              type="search"
              placeholder={t('documents_hub.search_placeholder')}
              wrapperClassName="block"
              className="w-full rounded-xl bg-white/10 pl-9 py-2.5 text-white placeholder:text-white/40 text-sm"
              clearButtonClassName="text-white/60 hover:text-white hover:bg-white/10"
            />
          </div>
        </div>
        <div className="overflow-x-auto flex gap-2 px-4 pb-3 scrollbar-hide">
          {CATEGORIES.map((c) => {
            const Icon = c.icon
            const count = c.id === 'all'
              ? documents.length
              : documents.filter((d) => !c.docType || d.doc_type === c.docType).length
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`flex items-center gap-2 shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${category === c.id ? 'bg-violet-600 text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'}`}
              >
                <Icon className="h-4 w-4" />
                {t(c.labelKey)}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 text-xs ${category === c.id ? 'bg-white/20' : 'bg-white/10'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setCategory('saved')}
            className={`flex items-center gap-2 shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${category === 'saved' ? 'bg-violet-600 text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'}`}
          >
            <FileText className="h-4 w-4" />
            {t('documents_hub.saved')}
            <span className={`rounded-full px-1.5 text-xs ${category === 'saved' ? 'bg-white/20' : 'bg-white/10'}`}>
              {documents.filter((d) => savedIds.includes(d.id)).length}
            </span>
          </button>
        </div>
        {actionHintKey ? (
          <div className="px-4 pb-3">
            <p className="inline-flex rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200">{t(actionHintKey)}</p>
          </div>
        ) : null}
      </header>

      <main className="px-4 py-4 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/50">{t('documents_hub.total_files')}</p>
            <p className="text-sm font-semibold">{documents.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/50">{t('documents_hub.storage')}</p>
            <p className="text-sm font-semibold">{formatSize(totalStorageBytes)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/50">{t('documents_hub.selected')}</p>
            <p className="text-sm font-semibold">{selectedIds.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/50">{t('documents_hub.selection_size')}</p>
            <p className="text-sm font-semibold">{formatSize(selectedSizeBytes)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setViewMode('list')} className={`rounded p-1.5 ${viewMode === 'list' ? 'bg-violet-600' : 'bg-white/10'}`} title={t('documents_hub.list')}><List className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setViewMode('grid')} className={`rounded p-1.5 ${viewMode === 'grid' ? 'bg-violet-600' : 'bg-white/10'}`} title={t('documents_hub.grid')}><Grid2X2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-white/50" />
              <button type="button" onClick={() => setStatusFilter('all')} className={`rounded-full px-3 py-1 text-xs ${statusFilter === 'all' ? 'bg-violet-600' : 'bg-white/10'}`}>{t('documents_hub.filter_all')}</button>
              <button type="button" onClick={() => setStatusFilter('signed')} className={`rounded-full px-3 py-1 text-xs ${statusFilter === 'signed' ? 'bg-violet-600' : 'bg-white/10'}`}>{t('documents_hub.filter_signed')}</button>
              <button type="button" onClick={() => setStatusFilter('unsigned')} className={`rounded-full px-3 py-1 text-xs ${statusFilter === 'unsigned' ? 'bg-violet-600' : 'bg-white/10'}`}>{t('documents_hub.filter_unsigned')}</button>
              <button type="button" onClick={() => setStatusFilter('expiring')} className={`rounded-full px-3 py-1 text-xs ${statusFilter === 'expiring' ? 'bg-violet-600' : 'bg-white/10'}`}>{t('documents_hub.filter_expiring')}</button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>{t('documents_hub.sorting')}</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'updated' | 'created' | 'size_desc' | 'size_asc' | 'title')}
              className="rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white"
            >
              <option value="updated">{t('documents_hub.sort_updated')}</option>
              <option value="created">{t('documents_hub.sort_created')}</option>
              <option value="title">{t('documents_hub.sort_title')}</option>
              <option value="size_desc">{t('documents_hub.sort_size_desc')}</option>
              <option value="size_asc">{t('documents_hub.sort_size_asc')}</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={selectAllVisible} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">{t('documents_hub.select_all')}</button>
            <button type="button" onClick={clearSelection} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">{t('documents_hub.clear_selection')}</button>
            <button type="button" onClick={() => setShowOnlySelected((s) => !s)} className={`rounded-lg px-3 py-1.5 text-xs ${showOnlySelected ? 'bg-violet-600' : 'bg-white/10'}`}>
              {showOnlySelected ? t('documents_hub.show_all') : t('documents_hub.only_selected')}
            </button>
            <button type="button" onClick={clearFilters} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs inline-flex items-center gap-1">
              <X className="h-3.5 w-3.5" />
              {t('documents_hub.reset_filters')}
            </button>
            <button type="button" onClick={copySelectionSummary} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs flex items-center gap-1"><Copy className="h-3.5 w-3.5" />{t('documents_hub.copy')}</button>
            <button type="button" onClick={exportCsv} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs flex items-center gap-1"><Database className="h-3.5 w-3.5" />{t('documents_hub.csv')}</button>
            <button type="button" onClick={downloadSelected} disabled={downloadingBulk || selectedDocs.length === 0} className="rounded-lg bg-violet-600/80 px-3 py-1.5 text-xs disabled:opacity-50 flex items-center gap-1"><Download className="h-3.5 w-3.5" />{downloadingBulk ? t('documents_hub.downloading') : t('documents_hub.download_selected')}</button>
          </div>
        </div>

        <DocumentList
          loading={loading}
          visibleDocs={visibleDocs}
          viewMode={viewMode}
          selectedIds={selectedIds}
          locale={locale}
          toggleSelectDoc={toggleSelectDoc}
          downloadOne={downloadOne}
          copyDocumentLink={copyDocumentLink}
          clearFilters={clearFilters}
          t={t}
        />
      </main>
      {selectedDocs.length > 0 && (
        <div className="fixed bottom-20 left-1/2 z-30 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 rounded-2xl border border-violet-400/40 bg-[#211b3a]/95 backdrop-blur p-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-violet-100">{selectedDocs.length} {t('documents_hub.selected')} · {formatSize(selectedSizeBytes)}</p>
            <div className="flex gap-2">
              <button type="button" onClick={copySelectionSummary} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">{t('documents_hub.copy')}</button>
              <button type="button" onClick={exportCsv} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">{t('documents_hub.csv')}</button>
              <button type="button" onClick={downloadSelected} disabled={downloadingBulk} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs disabled:opacity-50">
                {downloadingBulk ? t('documents_hub.downloading') : t('documents_hub.download')}
              </button>
              <button type="button" onClick={clearSelection} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">{t('documents_hub.clear_selection')}</button>
            </div>
          </div>
        </div>
      )}
      <BOLHNav current="profile" />
    </div>
  )
}
