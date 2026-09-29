import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query'
import type { Query } from '@tanstack/react-query'
import { dashboardClient, DashboardWidgetType, UpdateDashboardWidgetItem, UpdateDashboardWidgetsRequest } from '../api'
import type { DashboardStatsDto, DashboardWidgetDto } from '../api'
import type { LocalWidget } from './dashboard/types'
import { WIDGET_META, STAT_WIDGET_TYPES, DASHBOARD_STALE_TIME, DEFAULT_STAT_CONFIG, DEFAULT_CHART_CONFIG, DEFAULT_RESPONSE_TIME_CONFIG, DEFAULT_SLA_BREAKDOWN_CONFIG, DEFAULT_RECENT_TICKETS_CONFIG, DEFAULT_MY_OPEN_TICKETS_CONFIG, DEFAULT_CATEGORY_BREAKDOWN_CONFIG, DEFAULT_AGENT_PERFORMANCE_CONFIG, DEFAULT_CUSTOMER_ACTIVITY_CONFIG, DEFAULT_BACKLOG_AGE_CONFIG, DEFAULT_VOLUME_HEATMAP_CONFIG, DEFAULT_SLA_AT_RISK_CONFIG, DEFAULT_SERVICE_QUALITY_CONFIG, GRID_COLS, GRID_ROWS, GRID_GAP, GRID_CELL_MIN_H } from './dashboard/types'
import { parseConfig, hasCollision, findFreePosition } from './dashboard/widgetUtils'
import { WidgetBody } from './dashboard/WidgetBody'
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

const AUTO_REFRESH_STORAGE_KEY = 'dashboard.autoRefreshSeconds'
const AUTO_REFRESH_OPTIONS: { value: number; label: string }[] = [
  { value: 0,   label: 'Auto-frissítés: ki' },
  { value: 60,  label: 'Auto-frissítés: 1 perc' },
  { value: 300, label: 'Auto-frissítés: 5 perc' },
  { value: 900, label: 'Auto-frissítés: 15 perc' },
]

function loadAutoRefresh(): number {
  try {
    const v = Number(localStorage.getItem(AUTO_REFRESH_STORAGE_KEY))
    return AUTO_REFRESH_OPTIONS.some(o => o.value === v) ? v : 0
  } catch {
    return 0
  }
}

const STORE_OPEN_STORAGE_KEY = 'dashboard.storeOpen'

function loadStoreOpen(): boolean {
  try {
    return localStorage.getItem(STORE_OPEN_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function isDashboardDataQuery(query: Query): boolean {
  const key = query.queryKey[0]
  return typeof key === 'string' && (key.startsWith('analytics-') || key === 'dashboard-stats')
}

function toLocalWidgets(widgets: DashboardWidgetDto[]): LocalWidget[] {
  return widgets.map(w => ({
    id: w.id!,
    widgetType: w.widgetType!,
    col: w.col ?? 0,
    row: w.row ?? 0,
    colSpan: w.colSpan ?? 1,
    rowSpan: w.rowSpan ?? 1,
    config: parseConfig(w.widgetType!, w.config),
  }))
}

function saveErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    let e = error as { title?: string; detail?: string; errors?: Record<string, string[]>; message?: string; response?: unknown }
    // ApiException esetén a szerver válasza (ProblemDetails JSON) a response mezőben van
    if (typeof e.response === 'string') {
      try { e = { ...e, ...JSON.parse(e.response) } } catch { /* nem JSON */ }
    }
    const validation = e.errors ? Object.values(e.errors).flat().join(' ') : ''
    return validation || e.detail || e.title || e.message || 'ismeretlen hiba'
  }
  return 'ismeretlen hiba'
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

function defaultConfig(type: DashboardWidgetType): LocalWidget['config'] {
  if (type === DashboardWidgetType.TrendChart)        return DEFAULT_CHART_CONFIG
  if (type === DashboardWidgetType.RecentActivity)    return DEFAULT_RESPONSE_TIME_CONFIG
  if (type === DashboardWidgetType.SlaBreakdown)      return DEFAULT_SLA_BREAKDOWN_CONFIG
  if (type === DashboardWidgetType.RecentTickets)     return DEFAULT_RECENT_TICKETS_CONFIG
  if (type === DashboardWidgetType.MyOpenTickets)     return DEFAULT_MY_OPEN_TICKETS_CONFIG
  if (type === DashboardWidgetType.CategoryBreakdown) return DEFAULT_CATEGORY_BREAKDOWN_CONFIG
  if (type === DashboardWidgetType.AgentPerformance)  return DEFAULT_AGENT_PERFORMANCE_CONFIG
  if (type === DashboardWidgetType.CustomerActivity)  return DEFAULT_CUSTOMER_ACTIVITY_CONFIG
  if (type === DashboardWidgetType.BacklogAge)        return DEFAULT_BACKLOG_AGE_CONFIG
  if (type === DashboardWidgetType.VolumeHeatmap)     return DEFAULT_VOLUME_HEATMAP_CONFIG
  if (type === DashboardWidgetType.SlaAtRisk)         return DEFAULT_SLA_AT_RISK_CONFIG
  if (type === DashboardWidgetType.ServiceQuality)    return DEFAULT_SERVICE_QUALITY_CONFIG
  return DEFAULT_STAT_CONFIG
}

export function DashboardPage() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [draftWidgets, setDraftWidgets] = useState<LocalWidget[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // A drag ghost pozícióját közvetlenül a DOM-on frissítjük (ref), nem state-ben — különben minden
  // egérmozgás az egész dashboardot (és minden diagramot) újrarenderelné.
  const ghostRef = useRef<HTMLDivElement>(null)
  const lastPointerRef = useRef({ x: 0, y: 0 })

  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const draftRef = useRef<LocalWidget[]>(draftWidgets)
  const dragPreviewRef = useRef<{ col: number; row: number } | null>(null)
  const resizePreviewRef = useRef<{ colSpan: number; rowSpan: number } | null>(null)
  const [, setRenderTick] = useState(0) // csak újrarenderelés kiváltására (drag/resize előnézet)
  const pageRef = useRef<HTMLDivElement>(null)
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(loadAutoRefresh)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [storeOpen, setStoreOpen] = useState(loadStoreOpen)
  const [storeHiddenForDrag, setStoreHiddenForDrag] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<number | undefined>(undefined)

  function showNotice(message: string) {
    setNotice(message)
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 5000)
  }

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), [])
  const fetchingCount = useIsFetching({ predicate: isDashboardDataQuery })

  useEffect(() => { draftRef.current = draftWidgets }, [draftWidgets])

  const hasStatWidgets = draftWidgets.some(w => STAT_WIDGET_TYPES.includes(w.widgetType))
  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardClient.getStats(),
    enabled: hasStatWidgets,
    staleTime: DASHBOARD_STALE_TIME,
  })

  const widgetsQuery = useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: () => dashboardClient.getWidgets(),
  })

  // A mentett elrendezés csak nézet módban kerül a draftba — szerkesztés közben egy háttér-refetch
  // nem írhatja felül a még nem mentett módosításokat.
  useEffect(() => {
    if (widgetsQuery.data && mode === 'view') setDraftWidgets(toLocalWidgets(widgetsQuery.data))
  }, [widgetsQuery.data, mode])

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
    saveMutation.reset()
    // Reset draft from latest saved state
    if (widgetsQuery.data) setDraftWidgets(toLocalWidgets(widgetsQuery.data))
    setMode('edit')
    setSelectedId(null)
  }

  function cancelEdit() {
    saveMutation.reset()
    if (widgetsQuery.data) setDraftWidgets(toLocalWidgets(widgetsQuery.data))
    setMode('view')
    setSelectedId(null)
  }

  // ── Frissítés + TV mód ──────────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ predicate: isDashboardDataQuery })
    setLastUpdated(new Date())
  }, [queryClient])

  function changeAutoRefresh(seconds: number) {
    setAutoRefreshSeconds(seconds)
    try { localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(seconds)) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (mode !== 'view' || autoRefreshSeconds === 0) return
    const id = window.setInterval(refreshAll, autoRefreshSeconds * 1000)
    return () => window.clearInterval(id)
  }, [mode, autoRefreshSeconds, refreshAll])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === pageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleStore() {
    const next = !storeOpen
    setStoreOpen(next)
    try { localStorage.setItem(STORE_OPEN_STORAGE_KEY, String(next)) } catch { /* ignore */ }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ignore */ })
    } else {
      pageRef.current?.requestFullscreen().catch(() => { /* ignore */ })
    }
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
    if (!dragRef.current && !resizeRef.current) return

    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    if (ghostRef.current) {
      ghostRef.current.style.left = `${e.clientX + 12}px`
      ghostRef.current.style.top = `${e.clientY + 4}px`
    }

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
          if (hasCollision(current, TEMP_STORE_ID, col, row, drag.colSpan, drag.rowSpan)) {
            showNotice('Ide nem fér el a widget — válassz szabad területet, vagy használd a + gombot.')
          } else {
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
      setStoreHiddenForDrag(false)
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
    e.preventDefault() // ne jelöljön ki szöveget húzás közben
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
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
  function startStoreDrag(widgetType: DashboardWidgetType, e: React.PointerEvent) {
    e.preventDefault()
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    // Húzás közben a store elrejtőzik, hogy a teljes grid látszódjon és elérhető legyen dobáshoz
    setStoreHiddenForDrag(true)
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
    // Kézi elhelyezés (szerkesztő panel): a gridben kell maradnia és nem fedhet más widgetet
    const col = Math.max(0, Math.min(GRID_COLS - 1, updated.col))
    const row = Math.max(0, Math.min(GRID_ROWS - 1, updated.row))
    const colSpan = Math.max(1, Math.min(GRID_COLS - col, updated.colSpan))
    const rowSpan = Math.max(1, Math.min(GRID_ROWS - row, updated.rowSpan))
    if (hasCollision(draftWidgets, updated.id, col, row, colSpan, rowSpan)) {
      showNotice('Ez a pozíció/méret ütközik egy másik widgettel.')
      return
    }
    const next = { ...updated, col, row, colSpan, rowSpan }
    setDraftWidgets(prev => prev.map(w => w.id === next.id ? next : w))
  }

  function addWidgetFromStore(type: DashboardWidgetType) {
    const meta = WIDGET_META[type]
    const pos = findFreePosition(draftWidgets, meta.defaultColSpan, meta.defaultRowSpan)
    if (!pos) {
      showNotice(`Nincs elég szabad hely a(z) „${meta.label}” widgethez — méretezz át vagy törölj egy widgetet.`)
      return
    }
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
  const dragPreview = dragPreviewRef.current
  const resizePreview = resizePreviewRef.current
  const activeDrag = dragRef.current
  const activeResize = resizeRef.current

  const selectedWidget = draftWidgets.find(w => w.id === selectedId) ?? null

  const sortedWidgets = [...draftWidgets].sort((a, b) => a.row - b.row || a.col - b.col)

  return (
    <div ref={pageRef} className={`${styles.page} ${mode === 'edit' ? styles.editMode : ''} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <div className={styles.subtitle}>
            Napi áttekintés · {fetchingCount > 0 ? 'Frissítés…' : `Frissítve: ${formatTime(lastUpdated)}`}
          </div>
        </div>
        <div className={styles.headerActions}>
          {mode === 'view' ? (
            <>
              <select
                className={styles.refreshSelect}
                value={autoRefreshSeconds}
                onChange={e => changeAutoRefresh(Number(e.target.value))}
                title="Automatikus frissítés"
              >
                {AUTO_REFRESH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                className={styles.iconBtn}
                onClick={refreshAll}
                disabled={fetchingCount > 0}
                title="Frissítés most"
              >
                <span className={fetchingCount > 0 ? styles.spin : ''}>↻</span>
              </button>
              <button className={styles.iconBtn} onClick={toggleFullscreen} title={isFullscreen ? 'Kilépés a TV módból' : 'TV mód (teljes képernyő)'}>
                {isFullscreen ? '⤡' : '⛶'}
              </button>
              {!isFullscreen && <button className={styles.editBtn} onClick={enterEdit}>Szerkesztés</button>}
            </>
          ) : (
            <>
              <button
                className={`${styles.editBtn} ${storeOpen ? styles.toggleActive : ''}`}
                onClick={toggleStore}
                aria-pressed={storeOpen}
                title={storeOpen ? 'Widget store elrejtése' : 'Widget store megnyitása'}
              >
                {storeOpen ? '◧ Widgetek elrejtése' : '◨ Widgetek'}
              </button>
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
        {/* A store a grid fölé úszik (overlay), így nem nyomja össze a canvast */}
        {mode === 'edit' && storeOpen && (
          <WidgetStorePanel
            widgets={draftWidgets}
            hidden={storeHiddenForDrag}
            onStartDrag={(type, e) => startStoreDrag(type, e)}
            onAdd={addWidgetFromStore}
            onClose={toggleStore}
          />
        )}

        {/* Grid */}
        <div className={styles.gridArea}>
          {mode === 'edit' && saveMutation.isError && (
            <div className={styles.errorBanner} role="alert">
              A mentés nem sikerült: {saveErrorMessage(saveMutation.error)}
            </div>
          )}
          {notice && <div className={styles.noticeBanner} role="status">{notice}</div>}
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
                    <WidgetBody
                      widgetType={w.widgetType}
                      config={w.config}
                      stats={STAT_WIDGET_TYPES.includes(w.widgetType) ? stats : undefined}
                      editMode={mode === 'edit'}
                    />
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
          ref={ghostRef}
          className={styles.dragGhost}
          style={{ left: lastPointerRef.current.x + 12, top: lastPointerRef.current.y + 4 }}
        >
          {WIDGET_META[activeDrag.widgetType].icon} {activeDrag.label}
        </div>
      )}
    </div>
  )
}
