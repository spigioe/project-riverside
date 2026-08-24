import { DashboardWidgetType } from '../../api'
import type { LocalWidget, ChartConfig, ResponseTimeConfig, StatConfig, TimeRange, ChartType, Scope } from './types'
import { WIDGET_META } from './types'
import styles from './WidgetEditorPanel.module.css'

interface Props {
  widget: LocalWidget
  onUpdate: (updated: LocalWidget) => void
  onClose: () => void
  onDelete: () => void
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today',   label: 'Ma' },
  { value: 'week',    label: 'Ezen a héten' },
  { value: 'month',   label: 'Ezen a hónapban' },
  { value: '30days',  label: 'Elmúlt 30 nap' },
  { value: 'custom',  label: 'Egyéni' },
]

function ScopeSelect({ value, onChange }: { value: Scope; onChange: (v: Scope) => void }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>Hatókör</label>
      <select className={styles.select} value={value} onChange={e => onChange(e.target.value as Scope)}>
        <option value="all">Összes jegy</option>
        <option value="mine">Saját jegyek</option>
      </select>
    </div>
  )
}

function TimeRangeSelect({ value, onChange, dateFrom, dateTo, onDateFrom, onDateTo }: {
  value: TimeRange
  onChange: (v: TimeRange) => void
  dateFrom?: string
  dateTo?: string
  onDateFrom: (v: string) => void
  onDateTo: (v: string) => void
}) {
  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>Időszak</label>
        <select className={styles.select} value={value} onChange={e => onChange(e.target.value as TimeRange)}>
          {TIME_RANGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {value === 'custom' && (
        <div className={styles.dateRow}>
          <div className={styles.field}>
            <label className={styles.label}>Tól</label>
            <input type="date" className={styles.input} value={dateFrom ?? ''} onChange={e => onDateFrom(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Ig</label>
            <input type="date" className={styles.input} value={dateTo ?? ''} onChange={e => onDateTo(e.target.value)} />
          </div>
        </div>
      )}
    </>
  )
}

function StatEditor({ config, onChange }: { config: StatConfig; onChange: (c: StatConfig) => void }) {
  return (
    <ScopeSelect value={config.scope} onChange={v => onChange({ ...config, scope: v })} />
  )
}

function ChartEditor({ config, onChange }: { config: ChartConfig; onChange: (c: ChartConfig) => void }) {
  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>Diagram típus</label>
        <select className={styles.select} value={config.chartType} onChange={e => onChange({ ...config, chartType: e.target.value as ChartType })}>
          <option value="bar">Oszlopdiagram</option>
          <option value="line">Vonaldiagram</option>
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Csoportosítás</label>
        <select className={styles.select} value={config.groupBy} onChange={e => onChange({ ...config, groupBy: e.target.value as 'day' | 'hour' })}>
          <option value="day">Naponta</option>
          <option value="hour">Óránként</option>
        </select>
      </div>
      <ScopeSelect value={config.scope} onChange={v => onChange({ ...config, scope: v })} />
      <TimeRangeSelect
        value={config.timeRange}
        onChange={v => onChange({ ...config, timeRange: v })}
        dateFrom={config.dateFrom}
        dateTo={config.dateTo}
        onDateFrom={v => onChange({ ...config, dateFrom: v })}
        onDateTo={v => onChange({ ...config, dateTo: v })}
      />
    </>
  )
}

function ResponseTimeEditor({ config, onChange }: { config: ResponseTimeConfig; onChange: (c: ResponseTimeConfig) => void }) {
  return (
    <>
      <ScopeSelect value={config.scope} onChange={v => onChange({ ...config, scope: v })} />
      <TimeRangeSelect
        value={config.timeRange}
        onChange={v => onChange({ ...config, timeRange: v })}
        dateFrom={config.dateFrom}
        dateTo={config.dateTo}
        onDateFrom={v => onChange({ ...config, dateFrom: v })}
        onDateTo={v => onChange({ ...config, dateTo: v })}
      />
    </>
  )
}

export function WidgetEditorPanel({ widget, onUpdate, onClose, onDelete }: Props) {
  const meta = WIDGET_META[widget.widgetType]

  function updateConfig(newConfig: LocalWidget['config']) {
    onUpdate({ ...widget, config: newConfig })
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>{meta.label}</div>
        <button className={styles.closeBtn} onClick={onClose} title="Bezárás">×</button>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Beállítások</div>
          {widget.widgetType === DashboardWidgetType.TrendChart && (
            <ChartEditor config={widget.config as ChartConfig} onChange={updateConfig} />
          )}
          {widget.widgetType === DashboardWidgetType.RecentActivity && (
            <ResponseTimeEditor config={widget.config as ResponseTimeConfig} onChange={updateConfig} />
          )}
          {widget.widgetType !== DashboardWidgetType.TrendChart && widget.widgetType !== DashboardWidgetType.RecentActivity && (
            <StatEditor config={widget.config as StatConfig} onChange={updateConfig} />
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Elhelyezés</div>
          <div className={styles.gridRow}>
            <div className={styles.field}>
              <label className={styles.label}>Oszlop (1–6)</label>
              <input
                type="number" min={1} max={6} className={styles.input}
                value={widget.col + 1}
                onChange={e => onUpdate({ ...widget, col: Math.max(0, Math.min(5, Number(e.target.value) - 1)) })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Sor (1–8)</label>
              <input
                type="number" min={1} max={8} className={styles.input}
                value={widget.row + 1}
                onChange={e => onUpdate({ ...widget, row: Math.max(0, Math.min(7, Number(e.target.value) - 1)) })}
              />
            </div>
          </div>
          <div className={styles.gridRow}>
            <div className={styles.field}>
              <label className={styles.label}>Szélesség (oszlop)</label>
              <input
                type="number" min={1} max={6} className={styles.input}
                value={widget.colSpan}
                onChange={e => onUpdate({ ...widget, colSpan: Math.max(1, Math.min(6, Number(e.target.value))) })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Magasság (sor)</label>
              <input
                type="number" min={1} max={8} className={styles.input}
                value={widget.rowSpan}
                onChange={e => onUpdate({ ...widget, rowSpan: Math.max(1, Math.min(8, Number(e.target.value))) })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.deleteBtn} onClick={onDelete}>Törlés</button>
      </div>
    </div>
  )
}
