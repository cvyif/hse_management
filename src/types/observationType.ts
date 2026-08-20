/**
 * Database-driven Observation Type. The list of selectable types comes from
 * the `observationTypes` collection (seeded by `npm run seed:observations`),
 * so the UI is never hard-coded. Initial types:
 *
 *   Unsafe Act, Unsafe Condition, Near Miss, Positive Observation,
 *   Environmental Observation, PPE Violation, Fire & Safety, Work at Height,
 *   Lifting, Electrical, Confined Space, PTW Violation, Housekeeping, Other.
 */
export interface ObservationType {
  id: string
  /** Stable machine key, e.g. `UNSAFE_ACT`. */
  key: string
  label: string
  labelAr?: string
  sortOrder: number
  active: boolean
  createdAt: number
  updatedAt: number
}

/** The fourteen initial Observation Types seeded by the seed script. */
export const SEED_OBSERVATION_TYPES: ReadonlyArray<{
  key: string
  label: string
  labelAr: string
}> = [
  { key: 'UNSAFE_ACT', label: 'Unsafe Act', labelAr: 'سلوك غير آمن' },
  { key: 'UNSAFE_CONDITION', label: 'Unsafe Condition', labelAr: 'حالة غير آمنة' },
  { key: 'NEAR_MISS', label: 'Near Miss', labelAr: 'حادثة وشيكة' },
  { key: 'POSITIVE_OBSERVATION', label: 'Positive Observation', labelAr: 'ملاحظة إيجابية' },
  { key: 'ENVIRONMENTAL', label: 'Environmental Observation', labelAr: 'ملاحظة بيئية' },
  { key: 'PPE_VIOLATION', label: 'PPE Violation', labelAr: 'مخالفة معدات الوقاية الشخصية' },
  { key: 'FIRE_SAFETY', label: 'Fire & Safety', labelAr: 'السلامة من الحرائق' },
  { key: 'WORK_AT_HEIGHT', label: 'Work at Height', labelAr: 'العمل على الارتفاعات' },
  { key: 'LIFTING', label: 'Lifting', labelAr: 'عمليات الرفع' },
  { key: 'ELECTRICAL', label: 'Electrical', labelAr: 'أعمال كهربائية' },
  { key: 'CONFINED_SPACE', label: 'Confined Space', labelAr: 'الأماكن المغلقة' },
  { key: 'PTW_VIOLATION', label: 'PTW Violation', labelAr: 'مخالفة تصريح العمل' },
  { key: 'HOUSEKEEPING', label: 'Housekeeping', labelAr: 'النظافة والترتيب' },
  { key: 'OTHER', label: 'Other', labelAr: 'أخرى' },
]