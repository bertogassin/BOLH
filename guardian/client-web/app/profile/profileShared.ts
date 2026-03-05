export function formatMemberSince(dateStr?: string) {
  if (!dateStr) return 'févr. 2026'
  try {
    const d = new Date(dateStr)
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
    return `${months[d.getMonth()]} ${d.getFullYear()}`
  } catch {
    return 'févr. 2026'
  }
}

