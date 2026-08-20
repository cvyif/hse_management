import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AdminTable, Td, Th, TRow, THead } from '@/features/admin/AdminTable'
import { SECTION_COLORS } from '@/features/dashboard/dashboardLogic'
import { PERFORMANCE_COLUMNS } from '@/features/dashboard/performance'
import type { EntityPerformance } from '@/services/analytics.service'
import type { Section } from '@/types/area'

export interface PerformanceRow {
  id: string
  /** Display label (Company name or Area number/name, exactly as stored). */
  label: string
  /** Drill-down target: /observations?company=… or /observations?area=…. */
  linkTo: string
  /** Present only on Area rows. */
  section?: Section
  counts: EntityPerformance
}

/** OIL / GAS chip colored from the shared section palette. */
export function SectionChip({ section }: { section: Section }) {
  const { t } = useTranslation()
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: SECTION_COLORS[section] }}
    >
      {t(`sections.${section}`)}
    </span>
  )
}

/**
 * Task 7.3 shared Company/Area performance table: a labelled entity column
 * (drill-down link), an optional Section column and the numeric breakdown.
 * Numbers are tabular and right-aligned (logical `text-end`, so RTL mirrors);
 * the outer `AdminTable` scrolls horizontally on narrow screens.
 */
export function PerformanceTable({
  rows,
  variant,
}: {
  rows: readonly PerformanceRow[]
  variant: 'company' | 'area'
}) {
  const { t } = useTranslation()
  const entityLabel =
    variant === 'company'
      ? t('dashboard.performance.columns.company')
      : t('dashboard.performance.columns.area')

  return (
    <AdminTable>
      <THead>
        <Th>{entityLabel}</Th>
        {variant === 'area' && <Th>{t('dashboard.performance.columns.section')}</Th>}
        {PERFORMANCE_COLUMNS.map((column) => (
          <Th key={column} style={{ textAlign: 'end' }}>
            {t(`dashboard.performance.columns.${column}`)}
          </Th>
        ))}
      </THead>
      <tbody>
        {rows.map((row) => (
          <TRow key={row.id}>
            <Td className="whitespace-nowrap">
              <Link
                to={row.linkTo}
                className="font-medium text-sky-600 hover:underline"
              >
                {row.label}
              </Link>
            </Td>
            {variant === 'area' && row.section && (
              <Td className="whitespace-nowrap">
                <SectionChip section={row.section} />
              </Td>
            )}
            {PERFORMANCE_COLUMNS.map((column) => (
              <Td key={column} className="text-end tabular-nums text-slate-700">
                {row.counts[column]}
              </Td>
            ))}
          </TRow>
        ))}
      </tbody>
    </AdminTable>
  )
}