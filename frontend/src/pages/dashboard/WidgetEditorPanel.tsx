import { DashboardWidgetType } from '../../api'
import type { LocalWidget, ChartConfig, ResponseTimeConfig, StatConfig, TimeRange, ChartType, Scope, SlaBreakdownConfig, RecentTicketsConfig, MyOpenTicketsConfig, CategoryBreakdownConfig, AgentPerformanceConfig, CustomerActivityConfig } from './types'
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

function LimitSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>Megjelenített sorok</label>
      <select className={styles.select} value={value} onChange={e => onChange(Number(e.target.value))}>
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={20}>20</option>
      </select>
    </div>
  )
}

function SlaBreakdownEditor({ config, onChange }: { config: SlaBreakdownConfig; onChange: (c: SlaBreakdownConfig) => void }) {
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

function RecentTicketsEditor({ config, onChange }: { config: RecentTicketsConfig; onChange: (c: RecentTicketsConfig) => void }) {
  return (
    <>
      <LimitSelect value={config.limit} onChange={v => onChange({ ...config, limit: v })} />
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

function MyOpenTicketsEditor({ config, onChange }: { config: MyOpenTicketsConfig; onChange: (c: MyOpenTicketsConfig) => void }) {
  return <LimitSelect value={config.limit} onChange={v => onChange({ ...config, limit: v })} />
}

function CategoryBreakdownEditor({ config, onChange }: { config: CategoryBreakdownConfig; onChange: (c: CategoryBreakdownConfig) => void }) {
  return (
    <>
      <LimitSelect value={config.limit} onChange={v => onChange({ ...config, limit: v })} />
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

function AgentPerformanceEditor({ config, onChange }: { config: AgentPerformanceConfig; onChange: (c: AgentPerformanceConfig) => void }) {
  return (
    <TimeRangeSelect
      value={config.timeRange}
      onChange={v => onChange({ ...config, timeRange: v })}
      dateFrom={config.dateFrom}
      dateTo={config.dateTo}
      onDateFrom={v => onChange({ ...config, dateFrom: v })}
      onDateTo={v => onChange({ ...config, dateTo: v })}
    />
  )
}

function CustomerActivityEditor({ config, onChange }: { config: CustomerActivityConfig; onChange: (c: CustomerActivityConfig) => void }) {
  return (
    <>
      <LimitSelect value={config.limit} onChange={v => onChange({ ...config, limit: v })} />
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
          {widget.widgetType === DashboardWidgetType.SlaBreakdown && (
            <SlaBreakdownEditor config={widget.config as SlaBreakdownConfig} onChange={updateConfig} />
          )}
          {widget.widgetType === DashboardWidgetType.RecentTickets && (
            <RecentTicketsEditor config={widget.config as RecentTicketsConfig} onChange={updateConfig} />
          )}
          {widget.widgetType === DashboardWidgetType.MyOpenTickets && (
            <MyOpenTicketsEditor config={widget.config as MyOpenTicketsConfig} onChange={updateConfig} />
          )}
          {widget.widgetType === DashboardWidgetType.CategoryBreakdown && (
            <CategoryBreakdownEditor config={widget.config as CategoryBreakdownConfig} onChange={updateConfig} />
          )}
          {widget.widgetType === DashboardWidgetType.AgentPerformance && (
            <AgentPerformanceEditor config={widget.config as AgentPerformanceConfig} onChange={updateConfig} />
          )}
          {widget.widgetType === DashboardWidgetType.CustomerActivity && (
            <CustomerActivityEditor config={widget.config as CustomerActivityConfig} onChange={updateConfig} />
          )}
          {![DashboardWidgetType.TrendChart, DashboardWidgetType.RecentActivity, DashboardWidgetType.SlaBreakdown, DashboardWidgetType.RecentTickets, DashboardWidgetType.MyOpenTickets, DashboardWidgetType.CategoryBreakdown, DashboardWidgetType.AgentPerformance, DashboardWidgetType.CustomerActivity].includes(widget.widgetType) && (
            <StatEditor config={widget.config as StatConfig} onChange={updateConfig} />
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Elhelyezés</div>
          <div className={styles.gridRow}>
            <div className={styles.field}>
              <label className={styles.label}>Oszlop (1–8)</label>
              <input
                type="number" min={1} max={8} className={styles.input}
                value={widget.col + 1}
                onChange={e => onUpdate({ ...widget, col: Math.max(0, Math.min(7, Number(e.target.value) - 1)) })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Sor (1–10)</label>
              <input
                type="number" min={1} max={10} className={styles.input}
                value={widget.row + 1}
                onChange={e => onUpdate({ ...widget, row: Math.max(0, Math.min(9, Number(e.target.value) - 1)) })}
              />
            </div>
          </div>
          <div className={styles.gridRow}>
            <div className={styles.field}>
              <label className={styles.label}>Szélesség (oszlop)</label>
              <input
                type="number" min={1} max={8} className={styles.input}
                value={widget.colSpan}
                onChange={e => onUpdate({ ...widget, colSpan: Math.max(1, Math.min(8, Number(e.target.value))) })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Magasság (sor)</label>
              <input
                type="number" min={1} max={10} className={styles.input}
                value={widget.rowSpan}
                onChange={e => onUpdate({ ...widget, rowSpan: Math.max(1, Math.min(10, Number(e.target.value))) })}
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
