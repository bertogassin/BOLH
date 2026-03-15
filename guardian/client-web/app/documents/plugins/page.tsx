'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Puzzle, Plus, FileText, Receipt, Calendar, Building2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { fetchPlugins, fetchPluginTemplates, createPlugin, type Plugin, type PluginTemplate } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'doc.text.fill': FileText,
  'doc.text.magnifyingglass': FileText,
  'paintbrush.fill': Building2,
  'receipt.fill': Receipt,
  'calendar': Calendar,
}

export default function PluginsPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [templates, setTemplates] = useState<PluginTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([fetchPlugins(), fetchPluginTemplates()])
      .then(([pl, tm]) => {
        setPlugins(pl)
        setTemplates(tm)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const handleCreateFromTemplate = async (template: PluginTemplate) => {
    if (!user) return
    setCreating(template.id)
    try {
      const plugin = await createPlugin({
        name: template.name,
        description: template.description,
        icon: template.icon,
        plugin_type: 'agent',
        components: template.components.map((c) => ({ type: c })),
      })
      setPlugins((prev) => [plugin, ...prev])
      router.push(`/documents/plugins/${plugin.id}`)
      router.refresh()
    } catch {
      setCreating(null)
    }
  }

  if (!user) {
    return (
      <div className="theme-page min-h-screen text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  return (
    <div className="theme-page min-h-screen text-white pb-24">
      <header className="theme-header sticky top-0 z-10 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/documents" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('plugins.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-white/70 mb-2">{t('plugins.my_plugins')}</h2>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-16 rounded-xl bg-white/10" />
              <div className="h-16 rounded-xl bg-white/10" />
            </div>
          ) : plugins.length === 0 ? (
            <p className="text-white/50 text-sm py-2">{t('plugins.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {plugins.map((p) => (
                <Link
                  key={p.id}
                  href={`/documents/plugins/${p.id}`}
                  className="flex items-center gap-3 rounded-xl bg-white/10 p-4 hover:bg-white/15"
                >
                  <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Puzzle className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-white/50">{p.status}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/40 shrink-0" />
                </Link>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white/70 mb-2">{t('plugins.templates')}</h2>
          <ul className="space-y-2">
            {templates.map((template) => {
              const Icon = TEMPLATE_ICONS[template.icon] || Puzzle
              const isCreating = creating === template.id
              return (
                <li
                  key={template.id}
                  className="flex items-center gap-3 rounded-xl bg-white/10 p-4 hover:bg-white/15"
                >
                  <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-white/50 line-clamp-2">{template.description}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => handleCreateFromTemplate(template)}
                    className="shrink-0 flex items-center gap-1 rounded-lg bg-violet-600 py-2 px-3 text-sm text-white disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {isCreating ? t('plugins.creating') : t('plugins.create')}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
