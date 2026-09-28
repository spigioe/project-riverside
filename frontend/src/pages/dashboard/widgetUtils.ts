import type { TimeRange, WidgetConfig, StatConfig, ChartConfig, ResponseTimeConfig, SlaBreakdownConfig, RecentTicketsConfig, MyOpenTicketsConfig, CategoryBreakdownConfig, AgentPerformanceConfig, CustomerActivityConfig, BacklogAgeConfig, VolumeHeatmapConfig, SlaAtRiskConfig, ServiceQualityConfig } from './types'
import { DEFAULT_STAT_CONFIG, DEFAULT_CHART_CONFIG, DEFAULT_RESPONSE_TIME_CONFIG, DEFAULT_SLA_BREAKDOWN_CONFIG, DEFAULT_RECENT_TICKETS_CONFIG, DEFAULT_MY_OPEN_TICKETS_CONFIG, DEFAULT_CATEGORY_BREAKDOWN_CONFIG, DEFAULT_AGENT_PERFORMANCE_CONFIG, DEFAULT_CUSTOMER_ACTIVITY_CONFIG, DEFAULT_BACKLOG_AGE_CONFIG, DEFAULT_VOLUME_HEATMAP_CONFIG, DEFAULT_SLA_AT_RISK_CONFIG, DEFAULT_SERVICE_QUALITY_CONFIG } from './types'
import { DashboardWidgetType } from '../../api'

export function timeRangeToDates(range: TimeRange, customFrom?: string, customTo?: string): { from: Date | null; to: Date | null } {
  if (range === 'custom') {
    return {
      from: customFrom ? new Date(customFrom) : null,
      to: customTo ? new Date(customTo) : null,
    }
  }
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  if (range === 'today') {
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to }
  }
  if (range === 'week') {
    const from = new Date(now)
    from.setDate(from.getDate() - 7)
    from.setHours(0, 0, 0, 0)
    return { from, to }
  }
  if (range === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
  }
  if (range === '30days') {
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    from.setHours(0, 0, 0, 0)
    return { from, to }
  }
  return { from: null, to: null }
}

export function formatMinutes(minutes: number | undefined | null): string {
  if (minutes == null || isNaN(minutes)) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}p`
  if (m === 0) return `${h}ó`
  return `${h}ó ${m}p`
}

export function parseConfig(widgetType: DashboardWidgetType, raw: string | null | undefined): WidgetConfig {
  let parsed: object = {}
  if (raw) {
    try { parsed = JSON.parse(raw) } catch { /* ignore */ }
  }
  if (widgetType === DashboardWidgetType.TrendChart) {
    return { ...DEFAULT_CHART_CONFIG, ...parsed } as ChartConfig
  }
  if (widgetType === DashboardWidgetType.RecentActivity) {
    return { ...DEFAULT_RESPONSE_TIME_CONFIG, ...parsed } as ResponseTimeConfig
  }
  if (widgetType === DashboardWidgetType.SlaBreakdown) {
    return { ...DEFAULT_SLA_BREAKDOWN_CONFIG, ...parsed } as SlaBreakdownConfig
  }
  if (widgetType === DashboardWidgetType.RecentTickets) {
    return { ...DEFAULT_RECENT_TICKETS_CONFIG, ...parsed } as RecentTicketsConfig
  }
  if (widgetType === DashboardWidgetType.MyOpenTickets) {
    return { ...DEFAULT_MY_OPEN_TICKETS_CONFIG, ...parsed } as MyOpenTicketsConfig
  }
  if (widgetType === DashboardWidgetType.CategoryBreakdown) {
    return { ...DEFAULT_CATEGORY_BREAKDOWN_CONFIG, ...parsed } as CategoryBreakdownConfig
  }
  if (widgetType === DashboardWidgetType.AgentPerformance) {
    return { ...DEFAULT_AGENT_PERFORMANCE_CONFIG, ...parsed } as AgentPerformanceConfig
  }
  if (widgetType === DashboardWidgetType.CustomerActivity) {
    return { ...DEFAULT_CUSTOMER_ACTIVITY_CONFIG, ...parsed } as CustomerActivityConfig
  }
  if (widgetType === DashboardWidgetType.BacklogAge) {
    return { ...DEFAULT_BACKLOG_AGE_CONFIG, ...parsed } as BacklogAgeConfig
  }
  if (widgetType === DashboardWidgetType.VolumeHeatmap) {
    return { ...DEFAULT_VOLUME_HEATMAP_CONFIG, ...parsed } as VolumeHeatmapConfig
  }
  if (widgetType === DashboardWidgetType.SlaAtRisk) {
    return { ...DEFAULT_SLA_AT_RISK_CONFIG, ...parsed } as SlaAtRiskConfig
  }
  if (widgetType === DashboardWidgetType.ServiceQuality) {
    return { ...DEFAULT_SERVICE_QUALITY_CONFIG, ...parsed } as ServiceQualityConfig
  }
  return { ...DEFAULT_STAT_CONFIG, ...parsed } as StatConfig
}

export function hasCollision(widgets: { id: number; col: number; row: number; colSpan: number; rowSpan: number }[], excludeId: number, col: number, row: number, colSpan: number, rowSpan: number): boolean {
  for (const w of widgets) {
    if (w.id === excludeId) continue
    const noOverlap = col + colSpan <= w.col || w.col + w.colSpan <= col || row + rowSpan <= w.row || w.row + w.rowSpan <= row
    if (!noOverlap) return true
  }
  return false
}

export function findFreePosition(widgets: { col: number; row: number; colSpan: number; rowSpan: number }[], colSpan: number, rowSpan: number): { col: number; row: number } {
  for (let row = 0; row <= 10 - rowSpan; row++) {
    for (let col = 0; col <= 8 - colSpan; col++) {
      const noCollision = widgets.every(w => {
        return col + colSpan <= w.col || w.col + w.colSpan <= col || row + rowSpan <= w.row || w.row + w.rowSpan <= row
      })
      if (noCollision) return { col, row }
    }
  }
  return { col: 0, row: 0 }
}

export function formatHours(hours: number | undefined | null): string {
  if (hours == null || isNaN(hours)) return '—'
  if (hours < 24) return `${Math.round(hours)}ó`
  return `${Math.round(hours / 24)} nap`
}
