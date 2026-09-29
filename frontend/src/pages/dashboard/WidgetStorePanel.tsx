import { DashboardWidgetType } from '../../api'
import type { LocalWidget } from './types'
import { WIDGET_META, STAT_WIDGET_TYPES } from './types'
import { useAuthStore } from '../../store/useAuthStore'
import styles from './WidgetStorePanel.module.css'

interface Props {
  widgets: LocalWidget[]
  hidden: boolean
  onStartDrag: (widgetType: DashboardWidgetType, e: React.PointerEvent) => void
  onAdd: (widgetType: DashboardWidgetType) => void
  onClose: () => void
}

const ALL_WIDGET_TYPES: DashboardWidgetType[] = [
  ...STAT_WIDGET_TYPES,
  DashboardWidgetType.TrendChart,
  DashboardWidgetType.RecentActivity,
  DashboardWidgetType.SlaBreakdown,
  DashboardWidgetType.RecentTickets,
  DashboardWidgetType.MyOpenTickets,
  DashboardWidgetType.CategoryBreakdown,
  DashboardWidgetType.AgentPerformance,
  DashboardWidgetType.CustomerActivity,
  DashboardWidgetType.BacklogAge,
  DashboardWidgetType.VolumeHeatmap,
  DashboardWidgetType.SlaAtRisk,
  DashboardWidgetType.ServiceQuality,
]

const ADMIN_ONLY_TYPES = new Set([DashboardWidgetType.AgentPerformance])

export function WidgetStorePanel({ widgets, hidden, onStartDrag, onAdd, onClose }: Props) {
  const role = useAuthStore(s => s.user?.role ?? '')
  const isAdmin = role === 'Admin' || role === 'MasterAdmin'

  // Minden widget típus felhasználónként csak egyszer szerepelhet (backend validátor + egyedi index)
  function isDisabled(type: DashboardWidgetType): boolean {
    return widgets.some(w => w.widgetType === type)
  }

  const visibleTypes = ALL_WIDGET_TYPES.filter(t => !ADMIN_ONLY_TYPES.has(t) || isAdmin)

  return (
    <div className={`${styles.panel} ${hidden ? styles.panelHidden : ''}`}>
      <div className={styles.header}>
        <span>Widget hozzáadása</span>
        <button className={styles.closeBtn} onClick={onClose} title="Widget store elrejtése" aria-label="Widget store bezárása">×</button>
      </div>
      <div className={styles.hint}>Húzd a gridre, vagy kattints a + gombra</div>
      <div className={styles.list}>
        {visibleTypes.map(type => {
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
              {!disabled && (
                <button
                  className={styles.addBtn}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => onAdd(type)}
                  title="Hozzáadás az első szabad helyre"
                >+</button>
              )}
              <div className={styles.dragHandle} title="Húzd a gridre">⠿</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
