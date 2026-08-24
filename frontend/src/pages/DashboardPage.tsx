import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardClient, DashboardWidgetType, UpdateDashboardWidgetItem, UpdateDashboardWidgetsRequest } from '../api'
import type { DashboardStatsDto } from '../api'
import type { LocalWidget, ChartConfig, ResponseTimeConfig } from './dashboard/types'
import { WIDGET_META, DEFAULT_STAT_CONFIG, DEFAULT_CHART_CONFIG, DEFAULT_RESPONSE_TIME_CONFIG, GRID_COLS, GRID_ROWS, GRID_GAP, GRID_CELL_MIN_H } from './dashboard/types'
import { parseConfig, hasCollision, findFreePosition } from './dashboard/widgetUtils'
import { StatWidget } from './dashboard/StatWidget'
import { ChartWidget } from './dashboard/ChartWidget'
import { ResponseTimeWidget } from './dashboard/ResponseTimeWidget'
import { WidgetEditorPanel } from './dashboard/WidgetEditorPanel'
import { WidgetStorePanel } from './dashboard/WidgetStorePanel'
import styles from './DashboardPage.module.css'

let _nextId = -1
function nextTempId() { return _nextId-- }

interface DragState {
  type: 'widget' | 'store'
  widgetId: number          // for 'widget'; TEMP_STORE_ID for 'store'
  widgetType: DashboardWidgetType
  colSpan: number
  rowSpan: number
  offsetCol: number         // pointer offset within widget in cells
  offsetRow: number
  label: string
}

interface ResizeState {
  widgetId: number
  startColSpan: number
  startRowSpan: number
  startX: number
  startY: number
}

const TEMP_STORE_ID = -9999

function defaultConfig(type: DashboardWidgetType): LocalWidget['config'] {
  if (type === DashboardWidgetType.TrendChart) return DEFAULT_CHART_CONFIG
  if (type === DashboardWidgetType.RecentActivity) return DEFAULT_RESPONSE_TIME_CONFIG
  return DEFAULT_STAT_CONFIG
}

export function DashboardPage() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [draftWidgets, setDraftWidgets] = useState<LocalWidget[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 })

  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const draftRef = useRef<LocalWidget[]>(draftWidgets)
  const dragPreviewRef = useRef<{ col: number; row: number } | null>(null)
  const resizePreviewRef = useRef<{ colSpan: number; rowSpan: number } | null>(null)
  const [renderTick, setRenderTick] = useState(0)

  useEffect(() => { draftRef.current = draftWidgets }, [draftWidgets])

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardClient.getStats(),
  })

  const widgetsQuery = useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: () => dashboardClient.getWidgets(),
  })

  useEffect(() => {
    if (widgetsQuery.data) {
      const loaded: LocalWidget[] = widgetsQuery.data.map(w => ({
        id: w.id!,
        widgetType: w.widgetType!,
        col: w.col ?? 0,
        row: w.row ?? 0,
        colSpan: w.colSpan ?? 1,
        rowSpan: w.rowSpan ?? 1,
        config: parseConfig(w.widgetType!, w.config),
      }))
      setDraftWidgets(loaded)
    }
  }, [widgetsQuery.data])

  const saveMutation = useMutation({
    mutationFn: (widgets: LocalWidget[]) =>
      dashboardClient.saveWidgets(new UpdateDashboardWidgetsRequest({
        widgets: widgets.map(w =>
          new UpdateDashboardWidgetItem({
            widgetType: w.widgetType,
            col: w.col,
            row: w.row,
            colSpan: w.colSpan,
            rowSpan: w.rowSpan,
            config: JSON.stringify(w.config),
          })
        ),
      })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] })
      setMode('view')
      setSelectedId(null)
    },
  })

  function enterEdit() {
    // Reset draft from latest saved state
    if (widgetsQuery.data) {
      const loaded: LocalWidget[] = widgetsQuery.data.map(w => ({
        id: w.id!,
        widgetType: w.widgetType!,
        col: w.col ?? 0,
        row: w.row ?? 0,
        colSpan: w.colSpan ?? 1,
        rowSpan: w.rowSpan ?? 1,
        config: parseConfig(w.widgetType!, w.config),
      }))
      setDraftWidgets(loaded)
    }
    setMode('edit')
    setSelectedId(null)
  }

  function cancelEdit() {
    if (widgetsQuery.data) {
      const loaded: LocalWidget[] = widgetsQuery.data.map(w => ({
        id: w.id!,
        widgetType: w.widgetType!,
        col: w.col ?? 0,
        row: w.row ?? 0,
        colSpan: w.colSpan ?? 1,
        rowSpan: w.rowSpan ?? 1,
        config: parseConfig(w.widgetType!, w.config),
      }))
      setDraftWidgets(loaded)
    }
    setMode('view')
    setSelectedId(null)
  }

  // ── Grid coordinate helpers ───────────────────────────────────────────────
  function getGridMetrics() {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const cellW = (rect.width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
    return { rect, cellW, cellH: GRID_CELL_MIN_H, gap: GRID_GAP }
  }

  function pointerToCell(clientX: number, clientY: number): { col: number; row: number } | null {
    const m = getGridMetrics()
    if (!m) return null
    const { rect, cellW, cellH, gap } = m
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height + 200) return null
    const col = Math.floor(x / (cellW + gap))
    const row = Math.floor(y / (cellH + gap))
    return {
      col: Math.max(0, Math.min(GRID_COLS - 1, col)),
      row: Math.max(0, Math.min(GRID_ROWS - 1, row)),
    }
  }

  // ── DnD event handlers (attached to document) ────────────────────────────
  const onPointerMove = useCallback((e: PointerEvent) => {
    setPointerPos({ x: e.clientX, y: e.clientY })

    if (dragRef.current) {
      const drag = dragRef.current
      const cell = pointerToCell(e.clientX, e.clientY)
      let preview: { col: number; row: number } | null = null
      if (cell) {
        const col = Math.max(0, Math.min(GRID_COLS - drag.colSpan, cell.col - drag.offsetCol))
        const row = Math.max(0, Math.min(GRID_ROWS - drag.rowSpan, cell.row - drag.offsetRow))
        preview = { col, row }
      }
      const prev = dragPreviewRef.current
      if (prev?.col !== preview?.col || prev?.row !== preview?.row) {
        dragPreviewRef.current = preview
        setRenderTick(t => t + 1)
      }
    }

    if (resizeRef.current) {
      const resize = resizeRef.current
      const m = getGridMetrics()
      if (!m) return
      const { cellW, cellH, gap } = m
      const dx = e.clientX - resize.startX
      const dy = e.clientY - resize.startY
      const dCols = Math.round(dx / (cellW + gap))
      const dRows = Math.round(dy / (cellH + gap))
      const newColSpan = Math.max(1, Math.min(GRID_COLS, resize.startColSpan + dCols))
      const newRowSpan = Math.max(1, Math.min(GRID_ROWS, resize.startRowSpan + dRows))
      const prev = resizePreviewRef.current
      if (prev?.colSpan !== newColSpan || prev?.rowSpan !== newRowSpan) {
        resizePreviewRef.current = { colSpan: newColSpan, rowSpan: newRowSpan }
        setRenderTick(t => t + 1)
      }
    }
  }, [])

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (dragRef.current) {
      const drag = dragRef.current
      const cell = pointerToCell(e.clientX, e.clientY)
      if (cell) {
        const col = Math.max(0, Math.min(GRID_COLS - drag.colSpan, cell.col - drag.offsetCol))
        const row = Math.max(0, Math.min(GRID_ROWS - drag.rowSpan, cell.row - drag.offsetRow))
        const current = draftRef.current

        if (drag.type === 'store') {
          // Add new widget from store
          if (!hasCollision(current, TEMP_STORE_ID, col, row, drag.colSpan, drag.rowSpan)) {
            setDraftWidgets(prev => [...prev, {
              id: nextTempId(),
              widgetType: drag.widgetType,
              col, row,
              colSpan: drag.colSpan,
              rowSpan: drag.rowSpan,
              config: defaultConfig(drag.widgetType),
            }])
          }
        } else {
          // Move existing widget
          if (!hasCollision(current, drag.widgetId, col, row, drag.colSpan, drag.rowSpan)) {
            setDraftWidgets(prev => prev.map(w =>
              w.id === drag.widgetId ? { ...w, col, row } : w
            ))
          }
        }
      }
      dragRef.current = null
      dragPreviewRef.current = null
      setRenderTick(t => t + 1)
    }

    if (resizeRef.current) {
      const resize = resizeRef.current
      const preview = resizePreviewRef.current
      if (preview) {
        const widget = draftRef.current.find(w => w.id === resize.widgetId)
        if (widget) {
          const newColSpan = Math.min(preview.colSpan, GRID_COLS - widget.col)
          const newRowSpan = Math.min(preview.rowSpan, GRID_ROWS - widget.row)
          if (!hasCollision(draftRef.current, resize.widgetId, widget.col, widget.row, newColSpan, newRowSpan)) {
            setDraftWidgets(prev => prev.map(w =>
              w.id === resize.widgetId ? { ...w, colSpan: newColSpan, rowSpan: newRowSpan } : w
            ))
          }
        }
      }
      resizeRef.current = null
      resizePreviewRef.current = null
      setRenderTick(t => t + 1)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  // ── Widget drag start (from grid) ─────────────────────────────────────────
  function startWidgetDrag(widget: LocalWidget, e: React.PointerEvent) {
    if (mode !== 'edit') return
    e.stopPropagation()
    const m = getGridMetrics()
    if (!m) return
    const { cellW, cellH, gap } = m
    const widgetEl = (e.currentTarget as HTMLElement).closest('[data-widget-id]') as HTMLElement | null
    if (!widgetEl) return
    const wrect = widgetEl.getBoundingClientRect()
    const relX = e.clientX - wrect.left
    const relY = e.clientY - wrect.top
    const offsetCol = Math.floor(relX / (cellW + gap))
    const offsetRow = Math.floor(relY / (cellH + gap))
    dragRef.current = {
      type: 'widget',
      widgetId: widget.id,
      widgetType: widget.widgetType,
      colSpan: widget.colSpan,
      rowSpan: widget.rowSpan,
      offsetCol,
      offsetRow,
      label: WIDGET_META[widget.widgetType].label,
    }
    dragPreviewRef.current = { col: widget.col, row: widget.row }
    setRenderTick(t => t + 1)
  }

  // ── Widget drag start (from store) ────────────────────────────────────────
  function startStoreDrag(widgetType: DashboardWidgetType, _e: React.PointerEvent) {
    const meta = WIDGET_META[widgetType]
    dragRef.current = {
      type: 'store',
      widgetId: TEMP_STORE_ID,
      widgetType,
      colSpan: meta.defaultColSpan,
      rowSpan: meta.defaultRowSpan,
      offsetCol: 0,
      offsetRow: 0,
      label: meta.label,
    }
    dragPreviewRef.current = null
    setRenderTick(t => t + 1)
  }

  // ── Resize start ──────────────────────────────────────────────────────────
  function startResize(widget: LocalWidget, e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = {
      widgetId: widget.id,
      startColSpan: widget.colSpan,
      startRowSpan: widget.rowSpan,
      startX: e.clientX,
      startY: e.clientY,
    }
    resizePreviewRef.current = { colSpan: widget.colSpan, rowSpan: widget.rowSpan }
  }

  // ── Widget operations ─────────────────────────────────────────────────────
  function deleteWidget(id: number) {
    setDraftWidgets(prev => prev.filter(w => w.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function updateWidget(updated: LocalWidget) {
    setDraftWidgets(prev => prev.map(w => w.id === updated.id ? updated : w))
  }

  function addWidgetFromStore(type: DashboardWidgetType) {
    const meta = WIDGET_META[type]
    const pos = findFreePosition(draftWidgets, meta.defaultColSpan, meta.defaultRowSpan)
    setDraftWidgets(prev => [...prev, {
      id: nextTempId(),
      widgetType: type,
      col: pos.col,
      row: pos.row,
      colSpan: meta.defaultColSpan,
      rowSpan: meta.defaultRowSpan,
      config: defaultConfig(type),
    }])
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const stats = statsQuery.data as DashboardStatsDto | undefined
  const isDragging = dragRef.current !== null
  const isResizing = resizeRef.current !== null
  const dragPreview = dragPreviewRef.current
  const resizePreview = resizePreviewRef.current
  const activeDrag = dragRef.current
  const activeResize = resizeRef.current

  const selectedWidget = draftWidgets.find(w => w.id === selectedId) ?? null

  const sortedWidgets = [...draftWidgets].sort((a, b) => a.row - b.row || a.col - b.col)

  return (
    <div className={`${styles.page} ${mode === 'edit' ? styles.editMode : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <div className={styles.subtitle}>Napi áttekintés</div>
        </div>
        <div className={styles.headerActions}>
          {mode === 'view' ? (
            <button className={styles.editBtn} onClick={enterEdit}>Szerkesztés</button>
          ) : (
            <>
              <button className={styles.cancelBtn} onClick={cancelEdit} disabled={saveMutation.isPending}>Mégse</button>
              <button className={styles.saveBtn} onClick={() => saveMutation.mutate(draftWidgets)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Widget Store (edit mode) */}
        {mode === 'edit' && (
          <WidgetStorePanel
            widgets={draftWidgets}
            onStartDrag={(type, e) => startStoreDrag(type, e)}
          />
        )}

        {/* Grid */}
        <div className={styles.gridArea}>
          {(statsQuery.isLoading || widgetsQuery.isLoading) && (
            <div className={styles.loading}>Betöltés…</div>
          )}

          {!widgetsQuery.isLoading && draftWidgets.length === 0 && mode === 'view' && (
            <div className={styles.empty}>
              Nincs megjelenített widget — kattints a <strong>Szerkesztés</strong> gombra a hozzáadáshoz.
            </div>
          )}

          <div
            ref={gridRef}
            className={`${styles.grid} ${mode === 'edit' ? styles.gridEdit : ''}`}
          >
            {/* Drop preview (drag from store or widget) */}
            {isDragging && dragPreview && activeDrag && (
              <div
                className={styles.dropPreview}
                style={{
                  gridColumn: `${dragPreview.col + 1} / span ${activeDrag.colSpan}`,
                  gridRow: `${dragPreview.row + 1} / span ${activeDrag.rowSpan}`,
                }}
              />
            )}

            {/* Widgets */}
            {sortedWidgets.map(w => {
              const isBeingDragged = activeDrag?.type === 'widget' && activeDrag.widgetId === w.id
              const isBeingResized = activeResize?.widgetId === w.id
              const colSpan = isBeingResized && resizePreview ? resizePreview.colSpan : w.colSpan
              const rowSpan = isBeingResized && resizePreview ? resizePreview.rowSpan : w.rowSpan
              const isSelected = selectedId === w.id

              return (
                <div
                  key={w.id}
                  data-widget-id={w.id}
                  className={`${styles.widget} ${isBeingDragged ? styles.widgetDragging : ''} ${isSelected ? styles.widgetSelected : ''}`}
                  style={{
                    gridColumn: `${w.col + 1} / span ${colSpan}`,
                    gridRow: `${w.row + 1} / span ${rowSpan}`,
                  }}
                  onClick={mode === 'edit' ? () => setSelectedId(w.id === selectedId ? null : w.id) : undefined}
                >
                  {/* Widget header */}
                  <div className={styles.widgetHeader}>
                    {mode === 'edit' && (
                      <div
                        className={styles.dragHandle}
                        onPointerDown={(e) => startWidgetDrag(w, e)}
                        title="Húzás"
                      >⠿</div>
                    )}
                    <span className={styles.widgetTitle}>{WIDGET_META[w.widgetType].label}</span>
                    {mode === 'edit' && (
                      <div className={styles.widgetActions}>
                        <button
                          className={styles.widgetActionBtn}
                          onClick={(e) => { e.stopPropagation(); setSelectedId(w.id === selectedId ? null : w.id) }}
                          title="Beállítások"
                        >⚙</button>
                        <button
                          className={`${styles.widgetActionBtn} ${styles.deleteActionBtn}`}
                          onClick={(e) => { e.stopPropagation(); deleteWidget(w.id) }}
                          title="Törlés"
                        >×</button>
                      </div>
                    )}
                  </div>

                  {/* Widget content */}
                  <div className={styles.widgetContent}>
                    {w.widgetType === DashboardWidgetType.TrendChart ? (
                      <ChartWidget config={w.config as ChartConfig} />
                    ) : w.widgetType === DashboardWidgetType.RecentActivity ? (
                      <ResponseTimeWidget config={w.config as ResponseTimeConfig} />
                    ) : (
                      <StatWidget widgetType={w.widgetType} stats={stats} editMode={mode === 'edit'} />
                    )}
                  </div>

                  {/* Resize handle (edit mode) */}
                  {mode === 'edit' && (
                    <div
                      className={styles.resizeHandle}
                      onPointerDown={(e) => startResize(w, e)}
                      title="Átméretezés"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Widget Editor Panel */}
        {mode === 'edit' && selectedWidget && (
          <WidgetEditorPanel
            widget={selectedWidget}
            onUpdate={updateWidget}
            onClose={() => setSelectedId(null)}
            onDelete={() => deleteWidget(selectedWidget.id)}
          />
        )}
      </div>

      {/* Floating drag ghost */}
      {isDragging && activeDrag && (
        <div
          className={styles.dragGhost}
          style={{ left: pointerPos.x + 12, top: pointerPos.y + 4 }}
        >
          {WIDGET_META[activeDrag.widgetType].icon} {activeDrag.label}
        </div>
      )}
    </div>
  )
}
