import { useNavigate } from 'react-router-dom'
import { DashboardWidgetType, DashboardStatsDto } from '../../api'
import { STAT_NAV_URLS, WIDGET_META } from './types'
import styles from './widget.module.css'

interface Props {
  widgetType: DashboardWidgetType
  stats: DashboardStatsDto | null | undefined
  editMode: boolean
}

function statValue(type: DashboardWidgetType, stats: DashboardStatsDto): string {
  switch (type) {
    case DashboardWidgetType.Unresolved:    return String(stats.unresolved ?? 0)
    case DashboardWidgetType.Overdue:       return String(stats.overdue ?? 0)
    case DashboardWidgetType.DueToday:      return String(stats.dueToday ?? 0)
    case DashboardWidgetType.Open:          return String(stats.open ?? 0)
    case DashboardWidgetType.Unassigned:    return String(stats.unassigned ?? 0)
    case DashboardWidgetType.SlaCompliance: return `${stats.slaCompliance ?? 0}%`
    default: return '—'
  }
}

export function StatWidget({ widgetType, stats, editMode }: Props) {
  const navigate = useNavigate()
  const meta = WIDGET_META[widgetType]
  const navUrl = STAT_NAV_URLS[widgetType]
  const isOverdue = widgetType === DashboardWidgetType.Overdue
  const value = stats ? statValue(widgetType, stats) : '—'

  function handleClick() {
    if (!editMode && navUrl) navigate(navUrl)
  }

  return (
    <div
      className={`${styles.statContent} ${!editMode && navUrl ? styles.clickable : ''} ${isOverdue && stats?.overdue ? styles.danger : ''}`}
      onClick={handleClick}
      role={!editMode && navUrl ? 'button' : undefined}
      tabIndex={!editMode && navUrl ? 0 : undefined}
      onKeyDown={!editMode && navUrl ? (e) => { if (e.key === 'Enter') handleClick() } : undefined}
    >
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{meta.label}</div>
    </div>
  )
}
