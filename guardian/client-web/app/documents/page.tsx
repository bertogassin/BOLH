'use client'

import Link from 'next/link'
import {
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
    actionHint,
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
          <div>
            <h1 className="text-xl font-bold">Document Hub</h1>
            <p className="text-sm text-white/50">
              {documents.length} док. {needSignature.length > 0 ? `· ${needSignature.length} без подписи` : '· всё подписано'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-2 text-white/80"
              title="Обновить список"
            >
              <RotateCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/documents/upload" className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 text-sm font-medium">
              <span className="inline-flex items-center gap-1.5"><Upload className="h-4 w-4" />Загрузить</span>
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
              placeholder="Поиск (нажми /)"
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
                {c.label}
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
            Сохраненные
            <span className={`rounded-full px-1.5 text-xs ${category === 'saved' ? 'bg-white/20' : 'bg-white/10'}`}>
              {documents.filter((d) => savedIds.includes(d.id)).length}
            </span>
          </button>
        </div>
        {actionHint ? (
          <div className="px-4 pb-3">
            <p className="inline-flex rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200">{actionHint}</p>
          </div>
        ) : null}
      </header>

      <main className="px-4 py-4 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/50">Всего файлов</p>
            <p className="text-sm font-semibold">{documents.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/50">Хранилище</p>
            <p className="text-sm font-semibold">{formatSize(totalStorageBytes)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/50">Выбрано</p>
            <p className="text-sm font-semibold">{selectedIds.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/50">Объем выбора</p>
            <p className="text-sm font-semibold">{formatSize(selectedSizeBytes)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setViewMode('list')} className={`rounded p-1.5 ${viewMode === 'list' ? 'bg-violet-600' : 'bg-white/10'}`} title="Список"><List className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setViewMode('grid')} className={`rounded p-1.5 ${viewMode === 'grid' ? 'bg-violet-600' : 'bg-white/10'}`} title="Сетка"><Grid2X2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-white/50" />
              <button type="button" onClick={() => setStatusFilter('all')} className={`rounded-full px-3 py-1 text-xs ${statusFilter === 'all' ? 'bg-violet-600' : 'bg-white/10'}`}>Все</button>
              <button type="button" onClick={() => setStatusFilter('signed')} className={`rounded-full px-3 py-1 text-xs ${statusFilter === 'signed' ? 'bg-violet-600' : 'bg-white/10'}`}>Подписанные</button>
              <button type="button" onClick={() => setStatusFilter('unsigned')} className={`rounded-full px-3 py-1 text-xs ${statusFilter === 'unsigned' ? 'bg-violet-600' : 'bg-white/10'}`}>Без подписи</button>
              <button type="button" onClick={() => setStatusFilter('expiring')} className={`rounded-full px-3 py-1 text-xs ${statusFilter === 'expiring' ? 'bg-violet-600' : 'bg-white/10'}`}>Истекают</button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Сортировка</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'updated' | 'created' | 'size_desc' | 'size_asc' | 'title')}
              className="rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white"
            >
              <option value="updated">По обновлению</option>
              <option value="created">По дате создания</option>
              <option value="title">По названию</option>
              <option value="size_desc">Размер (больше)</option>
              <option value="size_asc">Размер (меньше)</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={selectAllVisible} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Выбрать всё</button>
            <button type="button" onClick={clearSelection} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Снять выбор</button>
            <button type="button" onClick={() => setShowOnlySelected((s) => !s)} className={`rounded-lg px-3 py-1.5 text-xs ${showOnlySelected ? 'bg-violet-600' : 'bg-white/10'}`}>
              {showOnlySelected ? 'Показать все' : 'Только выбранные'}
            </button>
            <button type="button" onClick={clearFilters} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs inline-flex items-center gap-1">
              <X className="h-3.5 w-3.5" />
              Сбросить фильтры
            </button>
            <button type="button" onClick={copySelectionSummary} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs flex items-center gap-1"><Copy className="h-3.5 w-3.5" />Копировать</button>
            <button type="button" onClick={exportCsv} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs flex items-center gap-1"><Database className="h-3.5 w-3.5" />CSV</button>
            <button type="button" onClick={downloadSelected} disabled={downloadingBulk || selectedDocs.length === 0} className="rounded-lg bg-violet-600/80 px-3 py-1.5 text-xs disabled:opacity-50 flex items-center gap-1"><Download className="h-3.5 w-3.5" />{downloadingBulk ? 'Скачивание...' : 'Скачать выбранные'}</button>
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
        />
      </main>
      {selectedDocs.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-30 rounded-2xl border border-violet-400/40 bg-[#211b3a]/95 backdrop-blur p-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-violet-100">{selectedDocs.length} выбрано · {formatSize(selectedSizeBytes)}</p>
            <div className="flex gap-2">
              <button type="button" onClick={copySelectionSummary} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Копировать</button>
              <button type="button" onClick={exportCsv} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">CSV</button>
              <button type="button" onClick={downloadSelected} disabled={downloadingBulk} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs disabled:opacity-50">
                {downloadingBulk ? 'Скачивание...' : 'Скачать'}
              </button>
              <button type="button" onClick={clearSelection} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Снять выбор</button>
            </div>
          </div>
        </div>
      )}
      <BOLHNav current="profile" />
    </div>
  )
}
