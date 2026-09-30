import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { ServiceQualityConfig } from './types'
import { timeRangeToDates } from './widgetUtils'
import { DASHBOARD_STALE_TIME } from './types'
import styles from './widget.module.css'

export function ServiceQualityWidget({ config }: { config: ServiceQualityConfig }) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-service-quality', config],
    queryFn: () => analyticsClient.getServiceQuality(from ?? undefined, to ?? undefined, config.scope),
    staleTime: DASHBOARD_STALE_TIME,
  })

  if (isLoading) return <div className={styles.rtLoading}>Betöltés…</div>
  if (!data || (data.ticketsCreated ?? 0) === 0) return <div className={styles.empty}>Nincs jegy az időszakban</div>

  const net = (data.ticketsCreated ?? 0) - (data.ticketsResolved ?? 0)

  return (
    <div className={styles.rtContent}>
      <div className={styles.rtMetric} title={`Megoldott jegyek, ahol egyetlen ügyintézői válasz elég volt (${data.fcrEligible ?? 0} jegyből)`}>
        <div className={styles.rtValue}>{data.fcrEligible ? `${Math.round(data.firstContactResolutionRate ?? 0)}%` : '—'}</div>
        <div className={styles.rtLabel}>Első kontaktusos megoldás</div>
      </div>
      <div className={styles.rtDivider} />
      <div className={styles.rtMetric} title={`${data.reopenedCount ?? 0} újranyitott jegy`}>
        <div className={`${styles.rtValue} ${(data.reopenRate ?? 0) > 10 ? styles.valueWarn : ''}`}>{Math.round(data.reopenRate ?? 0)}%</div>
        <div className={styles.rtLabel}>Újranyitási arány</div>
      </div>
      <div className={styles.rtDivider} />
      <div className={styles.rtMetric} title="Átlagos ügyintézői válaszok száma megoldott jegyenként">
        <div className={styles.rtValue}>{data.ticketsResolved ? (data.avgRepliesPerResolved ?? 0).toFixed(1) : '—'}</div>
        <div className={styles.rtLabel}>Válasz / megoldás</div>
      </div>
      <div className={styles.rtDivider} />
      <div className={styles.rtMetric} title={`${data.ticketsCreated} beérkezett, ${data.ticketsResolved} megoldott`}>
        <div className={`${styles.rtValue} ${net > 0 ? styles.valueWarn : styles.valueGood}`}>{net > 0 ? `+${net}` : net}</div>
        <div className={styles.rtLabel}>Backlog változás</div>
      </div>
    </div>
  )
}
