import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { AgentPerformanceConfig } from './types'
import { timeRangeToDates, formatMinutes } from './widgetUtils'
import styles from './widget.module.css'

export function AgentPerformanceWidget({ config }: { config: AgentPerformanceConfig }) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-agent-performance', config],
    queryFn: () => analyticsClient.getAgentPerformance(from ?? undefined, to ?? undefined),
    retry: false,
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (isError) return <div className={styles.empty}>Nincs hozzáférésed ehhez az adathoz</div>
  if (!data || data.length === 0) return <div className={styles.empty}>Nincs adat az időszakban</div>

  return (
    <div className={styles.agentTable}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Ügyintéző</th>
            <th className={styles.th}>Megoldott</th>
            <th className={styles.th}>Átl. 1. válasz</th>
            <th className={styles.th}>Átl. megoldás</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={styles.tr}>
              <td className={styles.td}>{row.agentName}</td>
              <td className={styles.tdNum}>{row.resolved}</td>
              <td className={styles.tdNum}>{formatMinutes(row.avgResponseMinutes)}</td>
              <td className={styles.tdNum}>{formatMinutes(row.avgResolutionMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
