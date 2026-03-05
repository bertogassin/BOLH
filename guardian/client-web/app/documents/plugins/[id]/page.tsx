'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Puzzle,
  Check,
  Users,
  MessageSquare,
  Download,
  UserPlus,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import {
  type Plugin,
  type PluginTeamMember,
  type PluginComment,
  getPlugin,
  publishPlugin,
  listPluginTeam,
  addPluginTeamMember,
  removePluginTeamMember,
  listPluginComments,
  addPluginComment,
  resolvePluginComment,
  downloadPluginExport,
} from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

type Tab = 'info' | 'team' | 'comments' | 'export'

export default function PluginDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const [plugin, setPlugin] = useState<Plugin | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [tab, setTab] = useState<Tab>('info')

  const [members, setMembers] = useState<PluginTeamMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState('viewer')
  const [addingMember, setAddingMember] = useState(false)

  const [comments, setComments] = useState<PluginComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const [exporting, setExporting] = useState(false)

  const loadPlugin = useCallback(() => {
    if (!user || !params.id) return
    setLoading(true)
    getPlugin(params.id)
      .then(setPlugin)
      .catch(() => setPlugin(null))
      .finally(() => setLoading(false))
  }, [user, params.id])

  useEffect(() => {
    loadPlugin()
  }, [loadPlugin])

  useEffect(() => {
    if (tab !== 'team' || !params.id) return
    setMembersLoading(true)
    listPluginTeam(params.id)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false))
  }, [tab, params.id])

  useEffect(() => {
    if (tab !== 'comments' || !params.id) return
    setCommentsLoading(true)
    listPluginComments(params.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false))
  }, [tab, params.id])

  const handlePublish = async () => {
    if (!params.id) return
    setPublishing(true)
    try {
      await publishPlugin(params.id, true)
      setPlugin((p) => (p ? { ...p, status: 'active', is_public: true } : null))
    } catch {
      // ignore
    } finally {
      setPublishing(false)
    }
  }

  const handleAddMember = async () => {
    if (!params.id || !addEmail.trim()) return
    setAddingMember(true)
    try {
      await addPluginTeamMember(params.id, { email: addEmail.trim(), role: addRole })
      setAddEmail('')
      listPluginTeam(params.id).then(setMembers)
    } catch {
      // ignore
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!params.id) return
    try {
      await removePluginTeamMember(params.id, userId)
      setMembers((m) => m.filter((x) => x.user_id !== userId))
    } catch {
      // ignore
    }
  }

  const handleAddComment = async () => {
    if (!params.id || !newComment.trim()) return
    setSubmittingComment(true)
    try {
      const c = await addPluginComment(params.id, { content: newComment.trim() })
      setComments((prev) => [...prev, c].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
      setNewComment('')
    } catch {
      // ignore
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleResolve = async (commentId: string, resolved: boolean) => {
    if (!params.id) return
    try {
      await resolvePluginComment(params.id, commentId, resolved)
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved } : c))
      )
    } catch {
      // ignore
    }
  }

  const handleExport = async () => {
    if (!params.id) return
    setExporting(true)
    try {
      await downloadPluginExport(params.id, 'html')
    } catch {
      // ignore
    } finally {
      setExporting(false)
    }
  }

  const isOwner = user && plugin && plugin.user_id === user.id

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  if (loading || !plugin) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white pb-24 flex items-center justify-center">
        {!loading && !plugin ? (
          <div className="text-center">
            <p className="text-white/60">{t('plugin_detail.not_found')}</p>
            <Link href="/documents/plugins" className="text-violet-400 mt-2 inline-block">{t('plugin_detail.back_to_list')}</Link>
          </div>
        ) : (
          <div className="animate-pulse w-full max-w-lg px-4 space-y-4">
            <div className="h-24 rounded-xl bg-white/10" />
            <div className="h-4 rounded bg-white/10 w-2/3" />
          </div>
        )}
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: t('plugin_detail.tab_info'), icon: <Puzzle className="h-4 w-4" /> },
    { key: 'team', label: t('plugin_detail.tab_team'), icon: <Users className="h-4 w-4" /> },
    { key: 'comments', label: t('plugin_detail.tab_comments'), icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'export', label: t('plugin_detail.tab_export'), icon: <Download className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/documents/plugins" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold truncate flex-1">{plugin.name}</h1>
        </div>
        <div className="flex border-t border-white/10">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm ${
                tab === key ? 'text-violet-400 border-b-2 border-violet-400' : 'text-white/60'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {tab === 'info' && (
          <>
            <div className="rounded-2xl bg-white/10 p-6 flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Puzzle className="h-8 w-8 text-violet-400" />
              </div>
              <p className="font-medium text-center">{plugin.name}</p>
              <p className="text-sm text-white/50 text-center">{plugin.description || t('plugin_detail.no_description')}</p>
              <span className="rounded bg-white/10 text-white/70 text-sm px-3 py-1">{plugin.status}</span>
            </div>
            {plugin.status !== 'active' && isOwner && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-white font-medium disabled:opacity-50"
              >
                <Check className="h-5 w-5" />
                {publishing ? t('plugin_detail.publishing') : t('plugin_detail.publish')}
              </button>
            )}
          </>
        )}

        {tab === 'team' && (
          <>
            {isOwner && (
              <div className="rounded-2xl bg-white/10 p-4 space-y-3">
                <p className="text-sm font-medium text-white/80">{t('plugin_detail.add_member')}</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder={t('plugin_detail.email')}
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/40"
                  />
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={addingMember || !addEmail.trim()}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {addingMember ? t('plugin_detail.adding') : t('plugin_detail.add')}
                </button>
              </div>
            )}
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm font-medium text-white/80 mb-3">{t('plugin_detail.members')}</p>
              {membersLoading ? (
                <p className="text-white/50 text-sm">{t('plugin_detail.loading')}</p>
              ) : members.length === 0 ? (
                <p className="text-white/50 text-sm">{t('plugin_detail.no_members')}</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li
                      key={m.user_id}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                    >
                      <span className="text-sm text-white/90">{m.user_id}</span>
                      <span className="text-xs text-white/50">{m.role}</span>
                      {isOwner && m.user_id !== user.id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="p-1.5 rounded text-red-400 hover:bg-red-400/20"
                          aria-label={t('plugin_detail.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {tab === 'comments' && (
          <>
            <div className="rounded-2xl bg-white/10 p-4 space-y-3">
              <textarea
                placeholder={t('plugin_detail.new_comment')}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/40 resize-none"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={submittingComment || !newComment.trim()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submittingComment ? t('plugin_detail.sending') : t('plugin_detail.send')}
              </button>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 space-y-3">
              <p className="text-sm font-medium text-white/80">{t('plugin_detail.comments')}</p>
              {commentsLoading ? (
                <p className="text-white/50 text-sm">{t('plugin_detail.loading')}</p>
              ) : comments.length === 0 ? (
                <p className="text-white/50 text-sm">{t('plugin_detail.no_comments')}</p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li
                      key={c.id}
                      className={`rounded-lg px-3 py-2 border-l-2 ${
                        c.resolved ? 'border-green-500/50 bg-white/5' : 'border-violet-500/50'
                      }`}
                    >
                      <p className="text-sm text-white/90">{c.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-white/50">{c.user_id} · {new Date(c.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : locale === 'fr' ? 'fr-FR' : locale === 'de' ? 'de-DE' : 'en-US')}</span>
                        {(isOwner || c.user_id === user.id) && (
                          <button
                            type="button"
                            onClick={() => handleResolve(c.id, !c.resolved)}
                            className="text-xs text-violet-400 hover:underline"
                          >
                            {c.resolved ? t('plugin_detail.reopen') : t('plugin_detail.resolve')}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {tab === 'export' && (
          <div className="rounded-2xl bg-white/10 p-6 flex flex-col items-center gap-4">
            <Download className="h-12 w-12 text-violet-400" />
            <p className="text-sm text-white/70 text-center">
              {t('plugin_detail.export_hint')}
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl bg-violet-600 py-3 px-6 text-white font-medium disabled:opacity-50"
            >
              {exporting ? t('plugin_detail.downloading') : t('plugin_detail.export_html')}
            </button>
          </div>
        )}
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
