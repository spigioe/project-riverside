import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardClient, DashboardWidgetType, UpdateDashboardWidgetItem, UpdateDashboardWidgetsRequest } from '../api'
import styles from './DashboardPage.module.css'

// A TrendChart és RecentActivity widget típusokhoz nincs Portal API adatforrás (a /api/v1/analytics/*
// csak a Developer API-n, X-Api-Key authentikációval érhető el, a JWT-s frontend nem hívhatja) —
// ezért ezek nem szerepelnek a választható/megjeleníthető widgetek között.
const WIDGET_META: Partial<Record<DashboardWidgetType, { label: string; format: (v: number) => string }>> = {
  [DashboardWidgetType.Unresolved]: { label: 'Nyitott ügyek', format: (v) => String(v) },
  [DashboardWidgetType.Overdue]: { label: 'Lejárt SLA', format: (v) => String(v) },
  [DashboardWidgetType.DueToday]: { label: 'Ma esedékes', format: (v) => String(v) },
  [DashboardWidgetType.Open]: { label: 'Nyitott (Open)', format: (v) => String(v) },
  [DashboardWidgetType.Unassigned]: { label: 'Hozzá nem rendelve', format: (v) => String(v) },
  [DashboardWidgetType.SlaCompliance]: { label: 'SLA teljesítés', format: (v) => `${v}%` },
}

const AVAILABLE_WIDGET_TYPES = Object.keys(WIDGET_META) as DashboardWidgetType[]

function statValue(type: DashboardWidgetType, stats: Record<string, number>): number {
  const key = type.charAt(0).toLowerCase() + type.slice(1)
  return stats[key] ?? 0
}

export function DashboardPage() {
  const queryClient = useQueryClient()
  const [manageOpen, setManageOpen] = useState(false)

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardClient.getStats(),
  })

  const widgetsQuery = useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: () => dashboardClient.getWidgets(),
  })

  const saveMutation = useMutation({
    mutationFn: (types: DashboardWidgetType[]) =>
      dashboardClient.saveWidgets(new UpdateDashboardWidgetsRequest({
        widgets: types.map((widgetType, index) =>
          new UpdateDashboardWidgetItem({ widgetType, positionX: index, positionY: 0, width: 1, height: 1 })),
      })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] }),
  })

  const stats = (statsQuery.data ?? {}) as unknown as Record<string, number>
  const widgets = (widgetsQuery.data ?? [])
    .filter((w) => AVAILABLE_WIDGET_TYPES.includes(w.widgetType!))
    .slice()
    .sort((a, b) => a.positionX! - b.positionX!)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <div className={styles.subtitle}>Napi áttekintés</div>
        </div>
        <button type="button" className={styles.manageButton} onClick={() => setManageOpen((v) => !v)}>
          Widgetek kezelése
        </button>
      </div>

      {manageOpen && (
        <div className={styles.managePanel}>
          {AVAILABLE_WIDGET_TYPES.map((type) => {
            const checked = widgets.some((w) => w.widgetType === type)
            return (
              <label key={type} className={styles.manageItem}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saveMutation.isPending}
                  onChange={(e) => {
                    const currentTypes = widgets.map((w) => w.widgetType!)
                    const nextTypes = e.target.checked
                      ? [...currentTypes, type]
                      : currentTypes.filter((t) => t !== type)
                    saveMutation.mutate(nextTypes)
                  }}
                />
                {WIDGET_META[type]!.label}
              </label>
            )
          })}
        </div>
      )}

      {(statsQuery.isLoading || widgetsQuery.isLoading) && <div className={styles.emptyState}>Betöltés…</div>}

      {!statsQuery.isLoading && !widgetsQuery.isLoading && widgets.length === 0 && (
        <div className={styles.emptyState}>Nincs megjelenített widget — állítsd be a "Widgetek kezelése" gombbal.</div>
      )}

      <div className={styles.grid}>
        {widgets.map((w) => {
          const meta = WIDGET_META[w.widgetType!]!
          return (
            <div key={w.id} className={styles.tile}>
              <div className={styles.tileValue}>{meta.format(statValue(w.widgetType!, stats))}</div>
              <div className={styles.tileLabel}>{meta.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
