import type { MapPoint } from '@/types/map'

/** Current epoch milliseconds. */
export function now(): number {
  return Date.now()
}

/** Convert a Firestore Timestamp-like value to epoch milliseconds. */
export function toMs(value: { seconds: number; nanoseconds?: number } | number | Date): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000)
}

/**
 * Build the sequential Observation ID, e.g. `OBS-2026-00001`.
 * The sequence is derived from a Firestore counter document.
 */
export function buildObservationId(year: number, sequence: number): string {
  return `OBS-${year}-${String(sequence).padStart(5, '0')}`
}

/**
 * Clamp a normalized map coordinate to the 0..1 range.
 */
export function clampMapPoint(point: MapPoint): MapPoint {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  }
}

/** Merge two objects, keeping known keys; used for profile updates. */
export function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key]
  }
  return result
}

/** Readable, localized date/time formatting helper (uses device locale). */
export function formatDateTime(ms: number, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms))
}

/** Readable, localized date-only formatting helper (uses device locale). */
export function formatDate(ms: number, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(ms))
}

/**
 * Localized relative time (e.g. "2 minutes ago") using
 * `Intl.RelativeTimeFormat` so both English and Arabic render naturally.
 */
export function formatRelativeTime(ms: number, locale = 'en'): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.round((ms - Date.now()) / 60_000)
  const absMinutes = Math.abs(minutes)
  if (absMinutes < 1) return formatter.format(0, 'minute')
  if (absMinutes < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  const days = Math.round(hours / 24)
  return formatter.format(days, 'day')
}