import { api, getToken } from './api_client'

export type Plugin = {
  id: string
  user_id: string
  user_type: string
  plugin_type: string
  name: string
  description: string
  icon: string
  color_scheme: Record<string, string>
  config: Record<string, unknown>
  components: Record<string, unknown>[]
  created_at: string
  updated_at: string
  status: string
  version: number
  is_public: boolean
}

export type PluginTemplate = {
  id: string
  name: string
  description: string
  icon: string
  category: string
  components: string[]
}

export type PluginTeamMember = {
  plugin_id: string
  user_id: string
  role: string
  added_by: string
  added_at: string
}

export type PluginComment = {
  id: string
  plugin_id: string
  user_id: string
  content: string
  parent_id?: string
  resolved: boolean
  created_at: string
}

export async function fetchPlugins(pluginType?: string): Promise<Plugin[]> {
  const q = pluginType ? `?plugin_type=${encodeURIComponent(pluginType)}` : ''
  const data = await api<{ plugins: Plugin[] }>(`/api/v1/plugins/my${q}`)
  return data.plugins
}

export async function getPlugin(id: string): Promise<Plugin> {
  return api<Plugin>(`/api/v1/plugins/${id}`)
}

export async function fetchPluginTemplates(): Promise<PluginTemplate[]> {
  const data = await api<{ templates: PluginTemplate[] }>('/api/v1/plugins/templates')
  return data.templates
}

export async function createPlugin(body: {
  plugin_type?: string
  name: string
  description?: string
  icon?: string
  color_scheme?: Record<string, string>
  components?: Record<string, unknown>[]
}): Promise<Plugin> {
  return api<Plugin>('/api/v1/plugins', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function publishPlugin(id: string, isPublic?: boolean): Promise<{ status: string }> {
  return api(`/api/v1/plugins/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ is_public: isPublic ?? false }),
  })
}

export async function listPluginTeam(id: string): Promise<PluginTeamMember[]> {
  const data = await api<{ members: PluginTeamMember[] }>(`/api/v1/plugins/${id}/team`)
  return data.members ?? []
}

export async function addPluginTeamMember(
  id: string,
  body: { user_id?: string; email?: string; role?: string }
): Promise<PluginTeamMember> {
  return api<PluginTeamMember>(`/api/v1/plugins/${id}/team`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function removePluginTeamMember(id: string, userId: string): Promise<void> {
  await api(`/api/v1/plugins/${id}/team/${userId}`, { method: 'DELETE' })
}

export async function listPluginComments(id: string): Promise<PluginComment[]> {
  const data = await api<{ comments: PluginComment[] }>(`/api/v1/plugins/${id}/comments`)
  return data.comments ?? []
}

export async function addPluginComment(
  id: string,
  body: { content: string; parent_id?: string }
): Promise<PluginComment> {
  return api<PluginComment>(`/api/v1/plugins/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function resolvePluginComment(
  id: string,
  commentId: string,
  resolved: boolean
): Promise<void> {
  await api(`/api/v1/plugins/${id}/comments/${commentId}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolved }),
  })
}

export async function downloadPluginExport(id: string, format: string = 'html'): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  const token = getToken()
  const res = await fetch(`${base}/api/v1/plugins/${id}/export?format=${encodeURIComponent(format)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plugin-${id}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

