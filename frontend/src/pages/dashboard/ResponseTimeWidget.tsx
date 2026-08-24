import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { ResponseTimeConfig } from './types'
import { timeRangeToDates, formatMinutes } from './widgetUtils'
import styles from './widget.module.css'

interface Props {
  config: ResponseTimeConfig
}

export function ResponseTimeWidget({ config }: Props) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-response-times', config.timeRange, config.scope, config.dateFrom, config.dateTo],
    queryFn: () => analyticsClient.getResponseTimes(from, to, config.scope === 'mine' ? 'mine' : null),
  })

  if (isLoading) {
    return <div className={styles.rtLoading}>Betöltés…</div>
  }

  return (
    <div className={styles.rtContent}>
      <div className={styles.rtMetric}>
        <div className={styles.rtValue}>{formatMinutes(data?.avgFirstResponseMinutes)}</div>
        <div className={styles.rtLabel}>Első válasz</div>
      </div>
      <div className={styles.rtDivider} />
      <div className={styles.rtMetric}>
        <div className={styles.rtValue}>{formatMinutes(data?.avgResponseMinutes)}</div>
        <div className={styles.rtLabel}>Átlag válasz</div>
      </div>
      <div className={styles.rtDivider} />
      <div className={styles.rtMetric}>
        <div className={styles.rtValue}>{formatMinutes(data?.avgResolutionMinutes)}</div>
        <div className={styles.rtLabel}>Megoldás</div>
      </div>
    </div>
  )
}
