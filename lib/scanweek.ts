/**
 * Scanweek-rekenhulp.
 *
 * Aanname: zwangerschap = 40 weken. De ideale scanperiode is week 34-36,
 * en we sturen een herinnering rond week 30 zodat er ruim tijd is om te boeken.
 *
 * We slaan op: current_week (zwangerschapsweek op aanmeldmoment) +
 * signup_week_date (de datum waarop die week gold). Daaruit leiden we alles af.
 */

export const REMINDER_WEEK = 30
export const IDEAL_WEEK_FROM = 34
export const IDEAL_WEEK_TO = 36
const TOTAL_WEEKS = 40

/** Huidige zwangerschapsweek op een gegeven peildatum. */
export function currentPregnancyWeek(currentWeekAtSignup: number, signupDate: string | Date, on: Date = new Date()): number {
  const d = typeof signupDate === 'string' ? new Date(signupDate + 'T00:00:00') : signupDate
  const days = Math.floor((on.getTime() - d.getTime()) / 86400000)
  return currentWeekAtSignup + Math.floor(days / 7)
}

/** Geschatte uitgerekende datum (ISO yyyy-mm-dd). */
export function estimatedDueDate(currentWeekAtSignup: number, signupDate: string | Date): string {
  const d = typeof signupDate === 'string' ? new Date(signupDate + 'T00:00:00') : new Date(signupDate)
  const weeksLeft = TOTAL_WEEKS - currentWeekAtSignup
  d.setDate(d.getDate() + weeksLeft * 7)
  return d.toISOString().slice(0, 10)
}

/** Datum waarop de reminder verstuurd moet worden (= week REMINDER_WEEK bereikt). */
export function reminderDate(currentWeekAtSignup: number, signupDate: string | Date): string {
  const d = typeof signupDate === 'string' ? new Date(signupDate + 'T00:00:00') : new Date(signupDate)
  const weeksUntil = REMINDER_WEEK - currentWeekAtSignup
  d.setDate(d.getDate() + Math.max(0, weeksUntil) * 7)
  return d.toISOString().slice(0, 10)
}
