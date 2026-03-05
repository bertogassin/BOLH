export function formatMemberSince(dateStr?: string) {
  if (!dateStr) return 'Feb 2026'
  try {
    const d = new Date(dateStr)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[d.getMonth()]} ${d.getFullYear()}`
  } catch {
    return 'Feb 2026'
  }
}

