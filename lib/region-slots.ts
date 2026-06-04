/**
 * "Display" slots per regio: hoe een volle dag eruit zou moeten zien
 * voor de bezoeker, ongeacht wat er op die specifieke dag in de DB staat.
 *
 * Slots die niet in availability.slots staan, worden als "Vol" (doorgestreept)
 * getoond. Dat creëert urgentie ("alleen nog 1 slot vrij") en verdoezelt
 * tegelijk dat Laila soms een kortere dag werkt.
 *
 * 09:00-10:00 staat altijd vóór de eigenlijke tijden zodat het lijkt alsof
 * de dag al om 9u begon en de vroege slots geboekt zijn.
 */
export const DISPLAY_SLOTS_BY_REGION: Record<string, string[]> = {
  'Noord-Holland & Flevoland': ['09:00', '09:30', '11:00', '12:30'],
  'Zuid-Holland': ['09:00', '10:00', '11:30', '13:00'],
  'Noord-Brabant': ['09:00', '10:30', '12:00', '13:30'],
  'Limburg': ['09:00', '10:30', '12:00', '13:30'],
  'Groningen, Friesland en Drenthe': ['09:00', '10:30', '12:00', '13:30'],
  'Utrecht & Gelderland & Overijssel': ['09:00', '10:30', '12:00', '13:30'],
  'Zeeland': ['09:00', '10:30', '12:00', '13:30'],
}

/** Fallback voor onbekende regio's */
export const DEFAULT_DISPLAY_SLOTS = ['09:00', '10:30', '12:00', '13:30']

export function getDisplaySlotsForRegion(region: string): string[] {
  return DISPLAY_SLOTS_BY_REGION[region] ?? DEFAULT_DISPLAY_SLOTS
}
