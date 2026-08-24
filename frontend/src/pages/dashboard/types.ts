import { DashboardWidgetType } from '../../api'

export type TimeRange = 'today' | 'week' | 'month' | '30days' | 'custom'
export type ChartType = 'line' | 'bar'
export type Scope = 'all' | 'mine'

export interface StatConfig {
  scope: Scope
}

export interface ChartConfig {
  chartType: ChartType
  groupBy: 'day' | 'hour'
  scope: Scope
  timeRange: TimeRange
  dateFrom?: string
  dateTo?: string
}

export interface ResponseTimeConfig {
  scope: Scope
  timeRange: TimeRange
  dateFrom?: string
  dateTo?: string
}

export interface SlaBreakdownConfig {
  scope: Scope
  timeRange: TimeRange
  dateFrom?: string
  dateTo?: string
}

export interface RecentTicketsConfig {
  limit: number
  timeRange: TimeRange
  dateFrom?: string
  dateTo?: string
}

export interface MyOpenTicketsConfig {
  limit: number
}

export interface CategoryBreakdownConfig {
  scope: Scope
  timeRange: TimeRange
  dateFrom?: string
  dateTo?: string
  limit: number
}

export interface AgentPerformanceConfig {
  timeRange: TimeRange
  dateFrom?: string
  dateTo?: string
}

export interface CustomerActivityConfig {
  timeRange: TimeRange
  dateFrom?: string
  dateTo?: string
  limit: number
}

export type WidgetConfig = StatConfig | ChartConfig | ResponseTimeConfig | SlaBreakdownConfig | RecentTicketsConfig | MyOpenTicketsConfig | CategoryBreakdownConfig | AgentPerformanceConfig | CustomerActivityConfig

export interface LocalWidget {
  id: number // negative = new (unsaved)
  widgetType: DashboardWidgetType
  col: number
  row: number
  colSpan: number
  rowSpan: number
  config: WidgetConfig
}

export const STAT_WIDGET_TYPES: DashboardWidgetType[] = [
  DashboardWidgetType.Unresolved,
  DashboardWidgetType.Overdue,
  DashboardWidgetType.DueToday,
  DashboardWidgetType.Open,
  DashboardWidgetType.Unassigned,
  DashboardWidgetType.SlaCompliance,
]

export interface WidgetMeta {
  label: string
  description: string
  defaultColSpan: number
  defaultRowSpan: number
  icon: string
}

export const WIDGET_META: Record<DashboardWidgetType, WidgetMeta> = {
  [DashboardWidgetType.Unresolved]:        { label: 'Nyitott ügyek',          description: 'Megoldatlan jegyek száma',                         defaultColSpan: 1, defaultRowSpan: 1, icon: '📋' },
  [DashboardWidgetType.Overdue]:           { label: 'Lejárt SLA',             description: 'SLA határidőt túllépett jegyek',                   defaultColSpan: 1, defaultRowSpan: 1, icon: '🔴' },
  [DashboardWidgetType.DueToday]:          { label: 'Ma esedékes',            description: 'Ma lejáró SLA határidős jegyek',                   defaultColSpan: 1, defaultRowSpan: 1, icon: '📅' },
  [DashboardWidgetType.Open]:              { label: 'Nyitott (Open)',          description: 'Open státuszú jegyek száma',                       defaultColSpan: 1, defaultRowSpan: 1, icon: '🔓' },
  [DashboardWidgetType.Unassigned]:        { label: 'Hozzá nem rendelve',     description: 'Nincs felelős hozzárendelve',                      defaultColSpan: 1, defaultRowSpan: 1, icon: '👤' },
  [DashboardWidgetType.SlaCompliance]:     { label: 'SLA teljesítés',         description: 'SLA megfelelési arány (%)',                        defaultColSpan: 1, defaultRowSpan: 1, icon: '✅' },
  [DashboardWidgetType.TrendChart]:        { label: 'Jegyvolumen diagram',    description: 'Beérkező és megoldott jegyek időbontásban',         defaultColSpan: 3, defaultRowSpan: 2, icon: '📊' },
  [DashboardWidgetType.RecentActivity]:    { label: 'Válaszidő metrikák',     description: 'Átlagos első válasz, válasz és megoldási idők',     defaultColSpan: 2, defaultRowSpan: 1, icon: '⏱️' },
  [DashboardWidgetType.SlaBreakdown]:      { label: 'SLA kördiagram',         description: 'SLA megfelelés vizuális áttekintése',              defaultColSpan: 2, defaultRowSpan: 2, icon: '🥧' },
  [DashboardWidgetType.RecentTickets]:     { label: 'Legújabb jegyek',        description: 'Utolsó beérkezett jegyek listája',                 defaultColSpan: 2, defaultRowSpan: 2, icon: '🆕' },
  [DashboardWidgetType.MyOpenTickets]:     { label: 'Saját nyitott jegyek',   description: 'Hozzád rendelt aktív jegyek SLA jelzővel',         defaultColSpan: 2, defaultRowSpan: 2, icon: '📌' },
  [DashboardWidgetType.CategoryBreakdown]: { label: 'Kategória megoszlás',    description: 'Jegyek eloszlása kategóriánként',                  defaultColSpan: 2, defaultRowSpan: 2, icon: '🗂️' },
  [DashboardWidgetType.AgentPerformance]:  { label: 'Ügyintéző teljesítmény', description: 'Megoldott jegyek és válaszidők ügyintézőnként',    defaultColSpan: 3, defaultRowSpan: 2, icon: '🏆' },
  [DashboardWidgetType.CustomerActivity]:  { label: 'Ügyfélforgalom',         description: 'Legtöbb jegyet beküldő cégek',                    defaultColSpan: 2, defaultRowSpan: 2, icon: '🏢' },
}

export const DEFAULT_STAT_CONFIG: StatConfig = { scope: 'all' }
export const DEFAULT_CHART_CONFIG: ChartConfig = { chartType: 'bar', groupBy: 'day', scope: 'all', timeRange: '30days' }
export const DEFAULT_RESPONSE_TIME_CONFIG: ResponseTimeConfig = { scope: 'all', timeRange: '30days' }
export const DEFAULT_SLA_BREAKDOWN_CONFIG: SlaBreakdownConfig = { scope: 'all', timeRange: '30days' }
export const DEFAULT_RECENT_TICKETS_CONFIG: RecentTicketsConfig = { limit: 10, timeRange: '30days' }
export const DEFAULT_MY_OPEN_TICKETS_CONFIG: MyOpenTicketsConfig = { limit: 10 }
export const DEFAULT_CATEGORY_BREAKDOWN_CONFIG: CategoryBreakdownConfig = { scope: 'all', timeRange: '30days', limit: 10 }
export const DEFAULT_AGENT_PERFORMANCE_CONFIG: AgentPerformanceConfig = { timeRange: '30days' }
export const DEFAULT_CUSTOMER_ACTIVITY_CONFIG: CustomerActivityConfig = { timeRange: '30days', limit: 10 }

export const STAT_NAV_URLS: Partial<Record<DashboardWidgetType, string>> = {
  [DashboardWidgetType.Unresolved]:    '/tickets?status=New,Open,Pending',
  [DashboardWidgetType.Overdue]:       '/tickets?slaBreach=true',
  [DashboardWidgetType.Open]:          '/tickets?status=Open',
  [DashboardWidgetType.Unassigned]:    '/tickets?unassigned=true',
  [DashboardWidgetType.DueToday]:      '/tickets?dueToday=true',
}

export const GRID_COLS = 8
export const GRID_ROWS = 10
export const GRID_GAP = 12
export const GRID_CELL_MIN_H = 120
