import { DashboardWidgetType } from '../../api'
import type { LocalWidget } from './types'
import { WIDGET_META, STAT_WIDGET_TYPES } from './types'
import styles from './WidgetStorePanel.module.css'

interface Props {
  widgets: LocalWidget[]
  onStartDrag: (widgetType: DashboardWidgetType, e: React.PointerEvent) => void
}

const ALL_WIDGET_TYPES: DashboardWidgetType[] = [
  ...STAT_WIDGET_TYPES,
  DashboardWidgetType.TrendChart,
  DashboardWidgetType.RecentActivity,
]

export function WidgetStorePanel({ widgets, onStartDrag }: Props) {
  function isDisabled(type: DashboardWidgetType): boolean {
    // Stat widgets: only one per type
    if (STAT_WIDGET_TYPES.includes(type)) {
      return widgets.some(w => w.widgetType === type)
    }
    return false
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Widget hozzáadása</div>
      <div className={styles.list}>
        {ALL_WIDGET_TYPES.map(type => {
          const meta = WIDGET_META[type]
          const disabled = isDisabled(type)
          return (
            <div
              key={type}
              className={`${styles.card} ${disabled ? styles.disabled : ''}`}
              onPointerDown={disabled ? undefined : (e) => onStartDrag(type, e)}
            >
              <div className={styles.icon}>{meta.icon}</div>
              <div className={styles.info}>
                <div className={styles.name}>{meta.label}</div>
                <div className={styles.desc}>{meta.description}</div>
              </div>
              <div className={styles.dragHandle} title="Húzd a gridre">⠿</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
