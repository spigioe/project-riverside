import { memo } from 'react'
import { DashboardWidgetType } from '../../api'
import type { DashboardStatsDto } from '../../api'
import type { WidgetConfig, ChartConfig, ResponseTimeConfig, SlaBreakdownConfig, RecentTicketsConfig, MyOpenTicketsConfig, CategoryBreakdownConfig, AgentPerformanceConfig, CustomerActivityConfig, BacklogAgeConfig, VolumeHeatmapConfig, SlaAtRiskConfig, ServiceQualityConfig } from './types'
import { StatWidget } from './StatWidget'
import { ChartWidget } from './ChartWidget'
import { ResponseTimeWidget } from './ResponseTimeWidget'
import { SlaBreakdownWidget } from './SlaBreakdownWidget'
import { RecentTicketsWidget } from './RecentTicketsWidget'
import { MyOpenTicketsWidget } from './MyOpenTicketsWidget'
import { CategoryBreakdownWidget } from './CategoryBreakdownWidget'
import { AgentPerformanceWidget } from './AgentPerformanceWidget'
import { CustomerActivityWidget } from './CustomerActivityWidget'
import { BacklogAgeWidget } from './BacklogAgeWidget'
import { VolumeHeatmapWidget } from './VolumeHeatmapWidget'
import { SlaAtRiskWidget } from './SlaAtRiskWidget'
import { ServiceQualityWidget } from './ServiceQualityWidget'

interface Props {
  widgetType: DashboardWidgetType
  config: WidgetConfig
  stats: DashboardStatsDto | undefined
  editMode: boolean
}

/**
 * A widget tartalma. memo-zott: a DashboardPage a drag/resize közben gyakran újrarenderel
 * (előnézet pozíció), de a diagramokat csak akkor kell újrarajzolni, ha a saját config-juk,
 * a statisztika adat vagy a mód változik.
 */
export const WidgetBody = memo(function WidgetBody({ widgetType, config, stats, editMode }: Props) {
  switch (widgetType) {
    case DashboardWidgetType.TrendChart:        return <ChartWidget config={config as ChartConfig} />
    case DashboardWidgetType.RecentActivity:    return <ResponseTimeWidget config={config as ResponseTimeConfig} />
    case DashboardWidgetType.SlaBreakdown:      return <SlaBreakdownWidget config={config as SlaBreakdownConfig} />
    case DashboardWidgetType.RecentTickets:     return <RecentTicketsWidget config={config as RecentTicketsConfig} />
    case DashboardWidgetType.MyOpenTickets:     return <MyOpenTicketsWidget config={config as MyOpenTicketsConfig} />
    case DashboardWidgetType.CategoryBreakdown: return <CategoryBreakdownWidget config={config as CategoryBreakdownConfig} />
    case DashboardWidgetType.AgentPerformance:  return <AgentPerformanceWidget config={config as AgentPerformanceConfig} />
    case DashboardWidgetType.CustomerActivity:  return <CustomerActivityWidget config={config as CustomerActivityConfig} />
    case DashboardWidgetType.BacklogAge:        return <BacklogAgeWidget config={config as BacklogAgeConfig} />
    case DashboardWidgetType.VolumeHeatmap:     return <VolumeHeatmapWidget config={config as VolumeHeatmapConfig} />
    case DashboardWidgetType.SlaAtRisk:         return <SlaAtRiskWidget config={config as SlaAtRiskConfig} />
    case DashboardWidgetType.ServiceQuality:    return <ServiceQualityWidget config={config as ServiceQualityConfig} />
    default:                                    return <StatWidget widgetType={widgetType} stats={stats} editMode={editMode} />
  }
})
