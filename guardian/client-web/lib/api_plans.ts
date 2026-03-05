import { api } from './api_client'

export type Plan = {
  id: string
  owner_id: string
  title: string
  description: string
  created_at: string
  updated_at: string
}

export type PlanTask = {
  id: string
  plan_id: string
  title: string
  description: string
  due_at?: string
  assignee_id: string
  status: 'todo' | 'in_progress' | 'done'
  sort_order: number
  created_at: string
  updated_at: string
}

export async function fetchPlans(): Promise<Plan[]> {
  const data = await api<{ plans: Plan[] }>('/api/v1/plans')
  return data.plans ?? []
}

export async function getPlan(id: string): Promise<{ plan: Plan; tasks: PlanTask[] }> {
  return api<{ plan: Plan; tasks: PlanTask[] }>(`/api/v1/plans/${id}`)
}

export async function createPlan(body: { title: string; description?: string }): Promise<Plan> {
  return api<Plan>('/api/v1/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePlan(id: string, body: { title?: string; description?: string }): Promise<Plan> {
  return api<Plan>(`/api/v1/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deletePlan(id: string): Promise<void> {
  await api(`/api/v1/plans/${id}`, { method: 'DELETE' })
}

export async function addPlanTask(
  planId: string,
  body: { title: string; description?: string; due_at?: string; assignee_id?: string; assignee_email?: string }
): Promise<PlanTask> {
  return api<PlanTask>(`/api/v1/plans/${planId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePlanTask(
  planId: string,
  taskId: string,
  body: { title?: string; description?: string; due_at?: string; assignee_id?: string; status?: string; sort_order?: number }
): Promise<PlanTask> {
  return api<PlanTask>(`/api/v1/plans/${planId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deletePlanTask(planId: string, taskId: string): Promise<void> {
  await api(`/api/v1/plans/${planId}/tasks/${taskId}`, { method: 'DELETE' })
}

