export type MissionHints = { objectLabel: string; tasks: string[] }

export function detectPlaceType(address: string): string {
  const v = address.toLowerCase()
  if (/villa|maison|house|дом|коттедж|вилл/.test(v)) return 'villa_house'
  if (/apartment|flat|residence|квартир|жил|подъезд/.test(v)) return 'residential'
  if (/shop|store|market|boutique|supermarket|магазин|супермаркет|рынок|торгов|тц/.test(v)) return 'store_commercial'
  if (/office|business|company|офис|бизнес|компан|бц|центр/.test(v)) return 'office_business'
  if (/hotel|otel|отел|гостиниц/.test(v)) return 'hotel'
  if (/warehouse|склад|логист/.test(v)) return 'warehouse'
  return ''
}

export function missionHintsByPlaceType(placeType: string): MissionHints | null {
  switch (placeType) {
    case 'villa_house':
      return {
        objectLabel: 'Villa / House',
        tasks: ['Perimeter patrol', 'Gate and visitor control', 'Night rounds'],
      }
    case 'residential':
      return {
        objectLabel: 'Residential building',
        tasks: ['Lobby access control', 'Common area monitoring', 'Incident response'],
      }
    case 'store_commercial':
      return {
        objectLabel: 'Store / Commercial site',
        tasks: ['Entry and anti-theft control', 'Cash/stock area monitoring', 'Crowd control'],
      }
    case 'office_business':
      return {
        objectLabel: 'Office / Business',
        tasks: ['Badge and visitor desk control', 'Reception/floor monitoring', 'After-hours rounds'],
      }
    case 'hotel':
      return {
        objectLabel: 'Hotel',
        tasks: ['Lobby/reception monitoring', 'Guest/service area patrol', 'Rapid response'],
      }
    case 'warehouse':
      return {
        objectLabel: 'Warehouse',
        tasks: ['Dock and gate control', 'Stock perimeter checks', 'Intrusion prevention'],
      }
    default:
      return null
  }
}
