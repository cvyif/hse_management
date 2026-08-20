import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/Badge'
import type { ObservationStatus, RiskLevel } from '@/types/observation'

/** Observation lifecycle status badge. */
export function ObservationStatusBadge({ status }: { status: ObservationStatus }) {
  const { t } = useTranslation()
  const tone =
    status === 'DRAFT'
      ? 'gray'
      : status === 'OPEN'
        ? 'blue'
        : status === 'CLOSED'
          ? 'green'
          : status === 'UNDER_VERIFICATION' || status === 'ACTION_REQUIRED' || status === 'ACTION_SUBMITTED'
            ? 'amber'
            : 'blue'
  return <Badge tone={tone}>{t(`observationStatus.${status}`)}</Badge>
}

/** Risk level badge (LOW → CRITICAL). */
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const { t } = useTranslation()
  const tone = risk === 'LOW' ? 'green' : risk === 'MEDIUM' ? 'amber' : 'red'
  return <Badge tone={tone}>{t(`observation.risk.${risk}`)}</Badge>
}