import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { htmlToPlainText } from '../lib/htmlText'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faChevronDown,
  faCircleQuestion,
  faFire,
  faTriangleExclamation,
  faLightbulb,
  faTag,
  faCircleDot,
  faClock,
  faCircleCheck,
  faLock,
  faInbox,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import {
  categoriesClient,
  companiesClient,
  meClient,
  ticketClient,
  usersClient,
  AssignCustomStatusRequest,
  CategoryDto,
  CompanyDto,
  CustomStatusDto,
  TicketListItemDto,
  TicketListView,
  TicketPriority,
  TicketSource,
  TicketStatus,
  TicketType,
  UpdateTicketPriorityRequest,
  UpdateTicketStatusRequest,
  UpdateTicketTypeRequest,
} from '../api'
import { useCustomStatuses, CUSTOM_STATUS_ICONS } from '../lib/customStatuses'
import { formatDateTime, formatTicketId } from '../lib/format'
import styles from './TicketsPage.module.css'
import dc from './DetailedCard.module.css'

const PAGE_SIZE = 20

// ── Helpers ──────────────────────────────────────────────

function hashAvatarColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const palette = ['#4A6CF7', '#6D3FC7', '#0891b2', '#059669', '#d97706', '#b91c1c', '#7c3aed', '#be185d']
  return palette[Math.abs(hash) % palette.length]
}

function formatRelativeTime(date: Date | undefined): string {
  if (!date) return ''
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'most'
  if (mins < 60) return `${mins} perce`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} órája`
  const days = Math.floor(hours / 24)
  return `${days} napja`
}

function flattenCategories(cats: CategoryDto[], out: CategoryDto[] = []): CategoryDto[] {
  for (const c of cats) {
    out.push(c)
    if (c.children?.length) flattenCategories(c.children, out)
  }
  return out
}

function slaClass(slaDueAt: Date | undefined, slaBreach: boolean | undefined): string | null {
  if (!slaDueAt) return null
  if (slaBreach || slaDueAt.getTime() < Date.now()) return dc.slaBreach
  const minsLeft = (slaDueAt.getTime() - Date.now()) / 60_000
  return minsLeft < 60 ? dc.slaWarning : dc.slaOk
}

function slaText(slaDueAt: Date | undefined, slaBreach: boolean | undefined): string | null {
  if (!slaDueAt) return null
  const diffMs = slaDueAt.getTime() - Date.now()
  const diffMins = Math.floor(diffMs / 60_000)
  if (slaBreach || diffMins < 0) {
    const abs = Math.abs(diffMins)
    const h = Math.floor(abs / 60), m = abs % 60
    return h > 0 ? `SLA: ${h}ó ${m}p lejárt` : `SLA: ${m}p lejárt`
  }
  const h = Math.floor(diffMins / 60), m = diffMins % 60
  return h > 0 ? `SLA: ${h}ó ${m}p` : `SLA: ${m}p`
}

// ── Sub-components ────────────────────────────────────────

const SOURCE_LABELS: Record<TicketSource, string> = {
  [TicketSource.Email]: '✉ Email',
  [TicketSource.Portal]: '🖥 Portál',
  [TicketSource.Manual]: '✏ Kézi',
  [TicketSource.Api]: '⚙ API',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.Low]: 'Alacsony',
  [TicketPriority.Medium]: 'Közepes',
  [TicketPriority.High]: 'Magas',
  [TicketPriority.Urgent]: 'Sürgős',
}

const TYPE_LABELS: Record<TicketType, string> = {
  [TicketType.Question]: 'Kérdés',
  [TicketType.Incident]: 'Incidens',
  [TicketType.Problem]: 'Probléma',
  [TicketType.FeatureRequest]: 'Funkciókérés',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.New]: 'Új',
  [TicketStatus.Open]: 'Nyitott',
  [TicketStatus.Pending]: 'Függőben',
  [TicketStatus.Resolved]: 'Megoldva',
  [TicketStatus.Closed]: 'Lezárva',
}

// ── Inline dropdown ───────────────────────────────────────

const PRIORITY_DOT: Record<TicketPriority, string> = {
  [TicketPriority.Low]: dc.dotLow,
  [TicketPriority.Medium]: dc.dotMedium,
  [TicketPriority.High]: dc.dotHigh,
  [TicketPriority.Urgent]: dc.dotUrgent,
}

const TYPE_ICON: Record<string, { icon: IconDefinition; color: string }> = {
  [TicketType.Question]:      { icon: faCircleQuestion,     color: 'var(--primary)' },
  [TicketType.Incident]:      { icon: faFire,               color: 'var(--red-text)' },
  [TicketType.Problem]:       { icon: faTriangleExclamation, color: 'var(--amber-text)' },
  [TicketType.FeatureRequest]:{ icon: faLightbulb,          color: 'var(--purple)' },
  '':                         { icon: faTag,                color: 'var(--text-muted)' },
}

const STATUS_ICON: Record<TicketStatus, { icon: IconDefinition; color: string }> = {
  [TicketStatus.New]:      { icon: faInbox,       color: 'var(--primary)' },
  [TicketStatus.Open]:     { icon: faCircleDot,   color: 'var(--green-text)' },
  [TicketStatus.Pending]:  { icon: faClock,       color: 'var(--amber-text)' },
  [TicketStatus.Resolved]: { icon: faCircleCheck, color: 'var(--green-text)' },
  [TicketStatus.Closed]:   { icon: faLock,        color: 'var(--text-muted)' },
}

const CUSTOM_STATUS_COLOR_VAR: Record<string, string> = {
  gray:    'var(--text-muted)',
  primary: 'var(--primary)',
  amber:   'var(--amber-text)',
  green:   'var(--green-text)',
  dark:    'var(--navy)',
  purple:  'var(--purple)',
  red:     'var(--red-text)',
}

// ── Tooltip ───────────────────────────────────────────────

interface TooltipProps {
  text: string | null | undefined
  children: React.ReactNode
}

function Tooltip({ text, children }: TooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  function show() {
    if (!text) return
    timerRef.current = setTimeout(() => {
      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect()
        setPos({ top: rect.bottom + 6, left: rect.left })
      }
    }, 400)
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPos(null)
  }

  const tooltipEl = pos && text ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: Math.min(pos.left, window.innerWidth - 310),
        maxWidth: 300,
        background: 'var(--navy)',
        color: '#fff',
        fontSize: 12,
        lineHeight: 1.45,
        borderRadius: 8,
        padding: '6px 10px',
        boxShadow: '2px 2px 6px rgba(16,22,47,0.25)',
        zIndex: 9999,
        pointerEvents: 'none',
        wordBreak: 'break-word',
      }}
    >
      {text.length > 200 ? `${text.slice(0, 200)}…` : text}
    </div>,
    document.body,
  ) : null

  return (
    <span ref={wrapRef} onMouseEnter={show} onMouseLeave={hide} style={{ display: 'contents' }}>
      {children}
      {tooltipEl}
    </span>
  )
}

interface DropdownOption {
  value: string
  label: string
  dotClass?: string
  icon?: IconDefinition
  iconColor?: string
}

interface InlineDropdownProps {
  value: string
  options: DropdownOption[]
  onChange: (v: string) => void
}

function InlineDropdown({ value, options, onChange }: InlineDropdownProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 3,
        right: window.innerWidth - rect.right,
        minWidth: Math.max(rect.width, 130),
      })
    }
    setOpen((o) => !o)
  }

  const current = options.find((o) => o.value === value)

  const menu = open && createPortal(
    <div ref={menuRef} className={dc.dropdownMenu} style={menuStyle}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${dc.dropdownItem} ${opt.value === value ? dc.dropdownItemActive : ''}`}
          onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false) }}
        >
          {opt.dotClass && <span className={`${dc.dot} ${opt.dotClass}`} />}
          {opt.icon && (
            <FontAwesomeIcon icon={opt.icon} style={{ color: opt.iconColor, fontSize: 11, width: 12 }} />
          )}
          {opt.label}
        </button>
      ))}
    </div>,
    document.body,
  )

  return (
    <div className={dc.dropdownWrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={dc.dropdownTrigger}
        onClick={handleOpen}
      >
        <span className={dc.dropdownLabel}>
          {current?.dotClass && <span className={`${dc.dot} ${current.dotClass}`} />}
          {current?.icon && (
            <FontAwesomeIcon icon={current.icon} style={{ color: current.iconColor, fontSize: 11 }} />
          )}
          {current?.label ?? value}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className={dc.dropdownCaret} />
      </button>
      {menu}
    </div>
  )
}

interface DetailedCardProps {
  ticket: TicketListItemDto
  customStatuses: CustomStatusDto[]
  onStatusChange: (id: number, status: TicketStatus) => void
  onCustomStatusChange: (id: number, key: string | null) => void
  onPriorityChange: (id: number, priority: TicketPriority) => void
  onTypeChange: (id: number, type: TicketType | null) => void
  onDelete: (id: number) => void
}

function DetailedCard({ ticket, customStatuses, onStatusChange, onCustomStatusChange, onPriorityChange, onTypeChange, onDelete }: DetailedCardProps) {
  const name = ticket.requesterName ?? ticket.requesterEmail ?? ''
  const initial = name.charAt(0).toUpperCase()
  const bgColor = hashAvatarColor(ticket.requesterEmail ?? name)

  const cls = slaClass(ticket.slaDueAt, ticket.slaBreach)
  const txt = slaText(ticket.slaDueAt, ticket.slaBreach)

  return (
    <div className={dc.card}>
      {/* Avatar */}
      <div className={dc.avatar} style={{ background: bgColor }} title={ticket.requesterEmail}>
        {ticket.source === TicketSource.Email
          ? <span className={dc.avatarIcon}>✉</span>
          : ticket.source === TicketSource.Portal
          ? <span className={dc.avatarIcon}>🖥</span>
          : <span>{initial}</span>
        }
      </div>

      {/* Middle */}
      <div className={dc.middle}>
        <div className={dc.topRow}>
          <Tooltip text={ticket.lastMessageBody ? htmlToPlainText(ticket.lastMessageBody) : null}>
            <Link to={`/tickets/${ticket.id}`} className={dc.subject}>
              {ticket.subject}
            </Link>
          </Tooltip>
          <span className={dc.ticketId}>{formatTicketId(ticket.id!)}</span>
        </div>
        <div className={dc.metaRow}>
          <span>{ticket.requesterName}</span>
          {ticket.requesterCompany && (
            <>
              <span className={dc.metaSep}>·</span>
              <span>{ticket.requesterCompany}</span>
            </>
          )}
          <span className={dc.metaSep}>·</span>
          <span>{SOURCE_LABELS[ticket.source!]}</span>
          {ticket.lastMessageAt && (
            <>
              <span className={dc.metaSep}>·</span>
              <span>Utoljára: {formatRelativeTime(ticket.lastMessageAt)}</span>
            </>
          )}
          {cls && txt && (
            <>
              <span className={dc.metaSep}>·</span>
              <span className={`${dc.slaIndicator} ${cls}`}>{txt}</span>
            </>
          )}
        </div>
      </div>

      {/* Right */}
      <div className={dc.right}>
        <InlineDropdown
          value={ticket.priority!}
          options={Object.values(TicketPriority).map((p) => ({ value: p, label: PRIORITY_LABELS[p], dotClass: PRIORITY_DOT[p] }))}
          onChange={(v) => onPriorityChange(ticket.id!, v as TicketPriority)}
        />

        <InlineDropdown
          value={ticket.type ?? ''}
          options={[
            { value: '', label: 'Nincs típus', ...TYPE_ICON[''] },
            ...Object.values(TicketType).map((t) => ({ value: t, label: TYPE_LABELS[t], ...TYPE_ICON[t] })),
          ]}
          onChange={(v) => onTypeChange(ticket.id!, v === '' ? null : v as TicketType)}
        />

        <InlineDropdown
          value={ticket.customStatusKey ?? ticket.status!}
          options={[
            ...Object.values(TicketStatus).map((s) => ({ value: s, label: STATUS_LABELS[s], ...STATUS_ICON[s] })),
            ...customStatuses.filter((cs) => cs.isActive).map((cs) => ({
              value: cs.key!,
              label: cs.name!,
              icon: CUSTOM_STATUS_ICONS[cs.iconKey ?? ''],
              iconColor: CUSTOM_STATUS_COLOR_VAR[cs.colorVariant ?? 'gray'] ?? 'var(--text-muted)',
            })),
          ]}
          onChange={(v) => {
            const isBuiltIn = (Object.values(TicketStatus) as string[]).includes(v)
            if (isBuiltIn) {
              onStatusChange(ticket.id!, v as TicketStatus)
              if (ticket.customStatusKey) onCustomStatusChange(ticket.id!, null)
            } else {
              onCustomStatusChange(ticket.id!, v)
            }
          }}
        />

        <button
          type="button"
          className={dc.deleteBtn}
          title="Törlés"
          onClick={(e) => { e.stopPropagation(); onDelete(ticket.id!) }}
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    </div>
  )
}

interface FilterState {
  assignedToId: string
  statuses: TicketStatus[]
  priorities: TicketPriority[]
  source: TicketSource | ''
  categoryId: string
  dateRange: 'any' | 'today' | 'week' | 'month'
  companyId: number | null
  showDeleted: boolean
}

const EMPTY_FILTER: FilterState = {
  assignedToId: '',
  statuses: [],
  priorities: [],
  source: '',
  categoryId: '',
  dateRange: 'any',
  companyId: null,
  showDeleted: false,
}

function hasActiveFilters(f: FilterState): boolean {
  return !!(f.assignedToId || f.statuses.length || f.priorities.length || f.source || f.categoryId || f.dateRange !== 'any' || f.companyId || f.showDeleted)
}

const FILTER_STORAGE_KEY = 'ticketListFilter'
const VIEW_STORAGE_KEY = 'ticketListView'
const COMPLETED_STATUSES = new Set<TicketStatus>([TicketStatus.Resolved, TicketStatus.Closed])

function loadFilter(): FilterState {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return EMPTY_FILTER
    const parsed = JSON.parse(raw) as FilterState
    return { ...EMPTY_FILTER, ...parsed }
  } catch {
    return EMPTY_FILTER
  }
}

function saveFilter(f: FilterState) {
  try { localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f)) } catch { /* noop */ }
}

function loadView(): TicketListView | null {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    return raw ? (raw as TicketListView) : null
  } catch {
    return null
  }
}

function saveView(v: TicketListView) {
  try { localStorage.setItem(VIEW_STORAGE_KEY, v) } catch { /* noop */ }
}

interface FilterPanelProps {
  filter: FilterState
  setFilter: (f: FilterState) => void
  users: { id?: number; fullName?: string }[]
  categories: CategoryDto[]
  companies: CompanyDto[]
}

function FilterPanel({ filter, setFilter, users, categories, companies }: FilterPanelProps) {
  function toggleStatus(s: TicketStatus) {
    const next = filter.statuses.includes(s)
      ? filter.statuses.filter((x) => x !== s)
      : [...filter.statuses, s]
    setFilter({ ...filter, statuses: next })
  }

  function togglePriority(p: TicketPriority) {
    const next = filter.priorities.includes(p)
      ? filter.priorities.filter((x) => x !== p)
      : [...filter.priorities, p]
    setFilter({ ...filter, priorities: next })
  }

  return (
    <div className={dc.filterPanel}>
      <div className={dc.filterTitle}>Szűrők</div>

      {/* Agent */}
      <div className={dc.filterSection}>
        <label className={dc.filterLabel}>Felelős</label>
        <select
          className={dc.filterSelect}
          value={filter.assignedToId}
          onChange={(e) => setFilter({ ...filter, assignedToId: e.target.value })}
        >
          <option value="">Mindenki</option>
          {users.map((u) => (
            <option key={u.id} value={String(u.id)}>{u.fullName}</option>
          ))}
        </select>
      </div>

      <hr className={dc.filterDivider} />

      {/* Status multi-select */}
      <div className={dc.filterSection}>
        <label className={dc.filterLabel}>Státusz</label>
        <div className={dc.multiPills}>
          {Object.values(TicketStatus).map((s) => (
            <button
              key={s}
              type="button"
              className={`${dc.pill} ${filter.statuses.includes(s) ? dc.pillActive : ''}`}
              onClick={() => toggleStatus(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <hr className={dc.filterDivider} />

      {/* Priority multi-select */}
      <div className={dc.filterSection}>
        <label className={dc.filterLabel}>Prioritás</label>
        <div className={dc.multiPills}>
          {Object.values(TicketPriority).map((p) => (
            <button
              key={p}
              type="button"
              className={`${dc.pill} ${filter.priorities.includes(p) ? dc.pillActive : ''}`}
              onClick={() => togglePriority(p)}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <hr className={dc.filterDivider} />

      {/* Source */}
      <div className={dc.filterSection}>
        <label className={dc.filterLabel}>Forrás</label>
        <select
          className={dc.filterSelect}
          value={filter.source}
          onChange={(e) => setFilter({ ...filter, source: e.target.value as TicketSource | '' })}
        >
          <option value="">Minden forrás</option>
          <option value={TicketSource.Email}>Email</option>
          <option value={TicketSource.Portal}>Portál</option>
          <option value={TicketSource.Manual}>Kézi</option>
          <option value={TicketSource.Api}>API</option>
        </select>
      </div>

      <hr className={dc.filterDivider} />

      {/* Category */}
      <div className={dc.filterSection}>
        <label className={dc.filterLabel}>Kategória</label>
        <select
          className={dc.filterSelect}
          value={filter.categoryId}
          onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })}
        >
          <option value="">Minden kategória</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>

      <hr className={dc.filterDivider} />

      {/* Date range */}
      <div className={dc.filterSection}>
        <label className={dc.filterLabel}>Létrehozva</label>
        <div className={dc.multiPills}>
          {(['any', 'today', 'week', 'month'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`${dc.pill} ${filter.dateRange === r ? dc.pillActive : ''}`}
              onClick={() => setFilter({ ...filter, dateRange: r })}
            >
              {r === 'any' ? 'Bármikor' : r === 'today' ? 'Ma' : r === 'week' ? 'E héten' : 'E hónapban'}
            </button>
          ))}
        </div>
      </div>

      {companies.length > 0 && (
        <>
          <hr className={dc.filterDivider} />
          <div className={dc.filterSection}>
            <label className={dc.filterLabel}>Cég</label>
            <select
              className={dc.filterSelect}
              value={filter.companyId ?? ''}
              onChange={(e) => setFilter({ ...filter, companyId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Minden cég</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <hr className={dc.filterDivider} />

      {/* Deleted */}
      <div className={dc.filterSection}>
        <label className={dc.filterLabel}>Törölt jegyek</label>
        <div className={dc.multiPills}>
          <button
            type="button"
            className={`${dc.pill} ${filter.showDeleted ? dc.pillActive : ''}`}
            onClick={() => setFilter({ ...filter, showDeleted: !filter.showDeleted })}
          >
            Törölt jegyek mutatása
          </button>
        </div>
      </div>

      {hasActiveFilters(filter) && (
        <button type="button" className={dc.clearFiltersBtn} onClick={() => setFilter(EMPTY_FILTER)}>
          Szűrők törlése
        </button>
      )}
    </div>
  )
}

// ── Active filter pills above list ─────────────────────────

interface ActivePillsProps {
  filter: FilterState
  setFilter: (f: FilterState) => void
  users: { id?: number; fullName?: string }[]
  categories: CategoryDto[]
  companies: CompanyDto[]
}

function ActiveFilterPills({ filter, setFilter, users, categories, companies }: ActivePillsProps) {
  const pills: { label: string; remove: () => void }[] = []

  if (filter.assignedToId) {
    const u = users.find((x) => String(x.id) === filter.assignedToId)
    pills.push({ label: `Felelős: ${u?.fullName ?? filter.assignedToId}`, remove: () => setFilter({ ...filter, assignedToId: '' }) })
  }
  for (const s of filter.statuses) {
    pills.push({ label: `Státusz: ${STATUS_LABELS[s]}`, remove: () => setFilter({ ...filter, statuses: filter.statuses.filter((x) => x !== s) }) })
  }
  for (const p of filter.priorities) {
    pills.push({ label: `Prioritás: ${PRIORITY_LABELS[p]}`, remove: () => setFilter({ ...filter, priorities: filter.priorities.filter((x) => x !== p) }) })
  }
  if (filter.source) {
    pills.push({ label: `Forrás: ${SOURCE_LABELS[filter.source]}`, remove: () => setFilter({ ...filter, source: '' }) })
  }
  if (filter.categoryId) {
    const cat = categories.find((c) => String(c.id) === filter.categoryId)
    pills.push({ label: `Kategória: ${cat?.name ?? filter.categoryId}`, remove: () => setFilter({ ...filter, categoryId: '' }) })
  }
  if (filter.dateRange !== 'any') {
    const label = filter.dateRange === 'today' ? 'Ma' : filter.dateRange === 'week' ? 'E héten' : 'E hónapban'
    pills.push({ label: `Dátum: ${label}`, remove: () => setFilter({ ...filter, dateRange: 'any' }) })
  }
  if (filter.companyId) {
    const company = companies.find((c) => c.id === filter.companyId)
    pills.push({ label: `Cég: ${company?.name ?? filter.companyId}`, remove: () => setFilter({ ...filter, companyId: null }) })
  }
  if (filter.showDeleted) {
    pills.push({ label: 'Törölt jegyek', remove: () => setFilter({ ...filter, showDeleted: false }) })
  }

  if (pills.length === 0) return null

  return (
    <div className={dc.activePills}>
      {pills.map((p, i) => (
        <span key={i} className={dc.activePill}>
          {p.label}
          <button type="button" className={dc.activePillRemove} onClick={p.remove}>×</button>
        </span>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────

export function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const search = searchParams.get('search') ?? ''
  const page = Number(searchParams.get('page') ?? '1')

  const [searchInput, setSearchInput] = useState(search)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [view, setViewRaw] = useState<TicketListView>(() => loadView() ?? TicketListView.Table)
  const [viewInitialized, setViewInitialized] = useState(false)
  const [detailedFilter, setDetailedFilterRaw] = useState<FilterState>(loadFilter)

  function setDetailedFilter(f: FilterState) {
    setDetailedFilterRaw(f)
    saveFilter(f)
  }

  function changeView(v: TicketListView) {
    setViewRaw(v)
    saveView(v)
  }

  const preferencesQuery = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => meClient.getPreferences(),
  })

  useEffect(() => {
    if (!viewInitialized && preferencesQuery.data) {
      if (!loadView()) setViewRaw(preferencesQuery.data.ticketListView!)
      setViewInitialized(true)
    }
  }, [preferencesQuery.data, viewInitialized])

  useEffect(() => { setSearchInput(search) }, [search])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== search) updateParams({ search: searchInput || null, page: null })
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  // Compute dateFrom from detailedFilter.dateRange
  function dateFromFilter(): Date | undefined {
    const now = new Date()
    if (detailedFilter.dateRange === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
    if (detailedFilter.dateRange === 'week') {
      const d = new Date(now)
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))
      d.setHours(0, 0, 0, 0)
      return d
    }
    if (detailedFilter.dateRange === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1)
    }
    return undefined
  }

  // FilterPanel is used in all views — apply its state universally
  // Backend supports single status/priority; multi-select is resolved client-side
  const effectiveStatus = detailedFilter.statuses.length === 1 ? detailedFilter.statuses[0] : undefined
  const effectivePriority = detailedFilter.priorities.length === 1 ? detailedFilter.priorities[0] : undefined
  const effectiveCategory = detailedFilter.categoryId ? Number(detailedFilter.categoryId) : undefined
  const effectiveAssignedTo = detailedFilter.assignedToId ? Number(detailedFilter.assignedToId) : undefined
  const effectiveSource = detailedFilter.source || undefined
  const effectiveDateFrom = dateFromFilter()
  const effectiveCompanyId = detailedFilter.companyId ?? undefined

  // Ha a szűrőben Resolved vagy Closed explicit ki van választva, mutassuk azokat is
  const userWantsCompleted = detailedFilter.statuses.some((s) => COMPLETED_STATUSES.has(s))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tickets', effectiveStatus, effectivePriority, effectiveCategory, search, page, effectiveAssignedTo, effectiveSource, detailedFilter.dateRange, effectiveCompanyId, userWantsCompleted, detailedFilter.showDeleted],
    queryFn: () =>
      ticketClient.getTickets(
        effectiveStatus,
        effectivePriority,
        effectiveCategory,
        search || undefined,
        effectiveDateFrom,
        undefined,
        page,
        PAGE_SIZE,
        effectiveAssignedTo,
        effectiveSource,
        effectiveCompanyId,
        undefined,
        userWantsCompleted || undefined,
        detailedFilter.showDeleted || undefined,
      ),
  })

  // Client-side multi-filter for statuses/priorities (backend only supports single value)
  let tickets = data?.items ?? []
  if (detailedFilter.statuses.length > 1) {
    tickets = tickets.filter((t) => detailedFilter.statuses.includes(t.status!))
  }
  if (detailedFilter.priorities.length > 1) {
    tickets = tickets.filter((t) => detailedFilter.priorities.includes(t.priority!))
  }

  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersClient.getUsers() })
  const categoriesQuery = useQuery({ queryKey: ['categories-tree'], queryFn: () => categoriesClient.getTree() })
  const companiesQuery = useQuery({ queryKey: ['companies-all'], queryFn: () => companiesClient.getAllCompanies() })
  const flatCategories = flattenCategories(categoriesQuery.data ?? [])

  const statusMutation = useMutation({
    mutationFn: ({ id, s }: { id: number; s: TicketStatus }) =>
      ticketClient.updateStatus(id, new UpdateTicketStatusRequest({ status: s })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const priorityMutation = useMutation({
    mutationFn: ({ id, p }: { id: number; p: TicketPriority }) =>
      ticketClient.updatePriority(id, new UpdateTicketPriorityRequest({ priority: p })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const typeMutation = useMutation({
    mutationFn: ({ id, t }: { id: number; t: TicketType | null }) =>
      ticketClient.updateType(id, new UpdateTicketTypeRequest({ type: t ?? undefined })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const customStatusesQuery = useCustomStatuses()
  const customStatuses = customStatusesQuery.data ?? []

  const customStatusMutation = useMutation({
    mutationFn: ({ id, key }: { id: number; key: string | null }) =>
      ticketClient.assignCustomStatus(id, new AssignCustomStatusRequest({ key: key ?? undefined })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ticketClient.deleteTicket(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  function handleDelete(id: number) {
    if (window.confirm(`Biztosan törölni szeretnéd a(z) #${id} jegyet? Ez a művelet nem vonható vissza.`)) {
      deleteMutation.mutate(id)
    }
  }

  function toggleAll() {
    if (selected.size === tickets.length) setSelected(new Set())
    else setSelected(new Set(tickets.map((t) => t.id!)))
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Ticketek</h1>
          <div className={styles.subtitle}>{totalCount} jegy összesen</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <input
            type="text"
            placeholder="Keresés tárgy, email, név szerint…"
            className={styles.searchInput}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${view === TicketListView.Table ? styles.viewToggleButtonActive : ''}`}
            onClick={() => changeView(TicketListView.Table)}
          >
            Táblázat
          </button>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${view === TicketListView.Card ? styles.viewToggleButtonActive : ''}`}
            onClick={() => changeView(TicketListView.Card)}
          >
            Kártyák
          </button>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${view === TicketListView.Detailed ? styles.viewToggleButtonActive : ''}`}
            onClick={() => changeView(TicketListView.Detailed)}
          >
            Részletes
          </button>
        </div>
      </div>

      {view === TicketListView.Detailed ? (
        /* ── Detailed view ── */
        <div className={styles.tableCard}>
          <div className={dc.detailedLayout}>
            <div className={dc.detailedList}>
              <ActiveFilterPills
                filter={detailedFilter}
                setFilter={setDetailedFilter}
                users={usersQuery.data ?? []}
                categories={flatCategories}
                companies={companiesQuery.data ?? []}
              />

              {isLoading && <div className={dc.empty}>Betöltés…</div>}
              {isError && <div className={dc.empty}>Hiba történt a jegyek betöltésekor.</div>}
              {!isLoading && !isError && tickets.length === 0 && (
                <div className={dc.empty}>Nincs a szűrésnek megfelelő jegy.</div>
              )}
              {tickets.map((ticket) => (
                <DetailedCard
                  key={ticket.id}
                  ticket={ticket}
                  customStatuses={customStatuses}
                  onStatusChange={(id, s) => statusMutation.mutate({ id, s })}
                  onCustomStatusChange={(id, key) => customStatusMutation.mutate({ id, key })}
                  onPriorityChange={(id, p) => priorityMutation.mutate({ id, p })}
                  onTypeChange={(id, t) => typeMutation.mutate({ id, t })}
                  onDelete={handleDelete}
                />
              ))}

              <div className={styles.pager}>
                <span className={styles.mono}>{rangeStart}–{rangeEnd} / {totalCount}</span>
                <div className={styles.pagerButtons}>
                  <button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>‹</button>
                  <span className={styles.pagerCurrent}>{page}</span>
                  <span className={styles.muted}>/ {totalPages || 1}</span>
                  <button disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>›</button>
                </div>
              </div>
            </div>

            <FilterPanel
              filter={detailedFilter}
              setFilter={setDetailedFilter}
              users={usersQuery.data ?? []}
              categories={flatCategories}
              companies={companiesQuery.data ?? []}
            />
          </div>
        </div>
      ) : view === TicketListView.Table ? (
        /* ── Table view ── */
        <div className={styles.tableCard}>
          <div className={dc.detailedLayout}>
            <div className={dc.detailedList}>
              <ActiveFilterPills
                filter={detailedFilter}
                setFilter={setDetailedFilter}
                users={usersQuery.data ?? []}
                categories={flatCategories}
                companies={companiesQuery.data ?? []}
              />
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.checkCol}>
                        <input
                          type="checkbox"
                          checked={tickets.length > 0 && selected.size === tickets.length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th>#ID</th>
                      <th>Tárgy</th>
                      <th>Kérelmező</th>
                      <th>Státusz</th>
                      <th>Prioritás</th>
                      <th>Típus</th>
                      <th>Felelős</th>
                      <th>Kategória</th>
                      <th>Dátum</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr><td colSpan={11} className={styles.emptyCell}>Betöltés…</td></tr>
                    )}
                    {isError && (
                      <tr><td colSpan={11} className={styles.emptyCell}>Hiba történt a jegyek betöltésekor.</td></tr>
                    )}
                    {!isLoading && !isError && tickets.length === 0 && (
                      <tr><td colSpan={11} className={styles.emptyCell}>Nincs a szűrésnek megfelelő jegy.</td></tr>
                    )}
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td className={styles.checkCol}>
                          <input
                            type="checkbox"
                            checked={selected.has(ticket.id!)}
                            onChange={() => toggleOne(ticket.id!)}
                          />
                        </td>
                        <td className={styles.mono}>{formatTicketId(ticket.id!)}</td>
                        <td className={styles.subjectCell}>
                          <Tooltip text={ticket.lastMessageBody ? htmlToPlainText(ticket.lastMessageBody) : null}>
                            <Link to={`/tickets/${ticket.id}`} className={styles.subjectLink}>{ticket.subject}</Link>
                          </Tooltip>
                        </td>
                        <td className={styles.muted}>{ticket.requesterEmail}</td>
                        <td>
                          <InlineDropdown
                            value={ticket.customStatusKey ?? ticket.status!}
                            options={[
                              ...Object.values(TicketStatus).map((s) => ({ value: s, label: STATUS_LABELS[s], ...STATUS_ICON[s] })),
                              ...customStatuses.filter((cs) => cs.isActive).map((cs) => ({
                                value: cs.key!,
                                label: cs.name!,
                                icon: CUSTOM_STATUS_ICONS[cs.iconKey ?? ''],
                                iconColor: CUSTOM_STATUS_COLOR_VAR[cs.colorVariant ?? 'gray'] ?? 'var(--text-muted)',
                              })),
                            ]}
                            onChange={(v) => {
                              const isBuiltIn = (Object.values(TicketStatus) as string[]).includes(v)
                              if (isBuiltIn) {
                                statusMutation.mutate({ id: ticket.id!, s: v as TicketStatus })
                                if (ticket.customStatusKey) customStatusMutation.mutate({ id: ticket.id!, key: null })
                              } else {
                                customStatusMutation.mutate({ id: ticket.id!, key: v })
                              }
                            }}
                          />
                        </td>
                        <td>
                          <InlineDropdown
                            value={ticket.priority!}
                            options={Object.values(TicketPriority).map((p) => ({ value: p, label: PRIORITY_LABELS[p], dotClass: PRIORITY_DOT[p] }))}
                            onChange={(v) => priorityMutation.mutate({ id: ticket.id!, p: v as TicketPriority })}
                          />
                        </td>
                        <td>
                          <InlineDropdown
                            value={ticket.type ?? ''}
                            options={[
                              { value: '', label: 'Nincs típus', ...TYPE_ICON[''] },
                              ...Object.values(TicketType).map((t) => ({ value: t, label: TYPE_LABELS[t], ...TYPE_ICON[t] })),
                            ]}
                            onChange={(v) => typeMutation.mutate({ id: ticket.id!, t: v === '' ? null : v as TicketType })}
                          />
                        </td>
                        <td>{ticket.assignedToName ?? '—'}</td>
                        <td className={styles.muted}>{ticket.categoryName ?? '—'}</td>
                        <td className={styles.mono}>{formatDateTime(ticket.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.deleteRowBtn}
                            title="Törlés"
                            onClick={() => handleDelete(ticket.id!)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.pager}>
                <span className={styles.mono}>{rangeStart}–{rangeEnd} / {totalCount}</span>
                <div className={styles.pagerButtons}>
                  <button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>‹</button>
                  <span className={styles.pagerCurrent}>{page}</span>
                  <span className={styles.muted}>/ {totalPages || 1}</span>
                  <button disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>›</button>
                </div>
              </div>
            </div>
            <FilterPanel
              filter={detailedFilter}
              setFilter={setDetailedFilter}
              users={usersQuery.data ?? []}
              categories={flatCategories}
              companies={companiesQuery.data ?? []}
            />
          </div>
        </div>
      ) : (
        /* ── Card view ── */
        <div className={styles.tableCard}>
          <div className={dc.detailedLayout}>
            <div className={dc.detailedList}>
              <ActiveFilterPills
                filter={detailedFilter}
                setFilter={setDetailedFilter}
                users={usersQuery.data ?? []}
                categories={flatCategories}
                companies={companiesQuery.data ?? []}
              />
              <div className={styles.cardGrid}>
                {isLoading && <div className={styles.emptyCell}>Betöltés…</div>}
                {isError && <div className={styles.emptyCell}>Hiba történt a jegyek betöltésekor.</div>}
                {!isLoading && !isError && tickets.length === 0 && (
                  <div className={styles.emptyCell}>Nincs a szűrésnek megfelelő jegy.</div>
                )}
                {tickets.map((ticket) => (
                  <div key={ticket.id} className={styles.ticketCard}>
                    <div className={styles.ticketCardHeader}>
                      <span className={styles.mono}>{formatTicketId(ticket.id!)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <InlineDropdown
                          value={ticket.customStatusKey ?? ticket.status!}
                          options={[
                            ...Object.values(TicketStatus).map((s) => ({ value: s, label: STATUS_LABELS[s], ...STATUS_ICON[s] })),
                            ...customStatuses.filter((cs) => cs.isActive).map((cs) => ({
                              value: cs.key!,
                              label: cs.name!,
                              icon: CUSTOM_STATUS_ICONS[cs.iconKey ?? ''],
                              iconColor: CUSTOM_STATUS_COLOR_VAR[cs.colorVariant ?? 'gray'] ?? 'var(--text-muted)',
                            })),
                          ]}
                          onChange={(v) => {
                            const isBuiltIn = (Object.values(TicketStatus) as string[]).includes(v)
                            if (isBuiltIn) {
                              statusMutation.mutate({ id: ticket.id!, s: v as TicketStatus })
                              if (ticket.customStatusKey) customStatusMutation.mutate({ id: ticket.id!, key: null })
                            } else {
                              customStatusMutation.mutate({ id: ticket.id!, key: v })
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.deleteRowBtn}
                          title="Törlés"
                          onClick={() => handleDelete(ticket.id!)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                    <Tooltip text={ticket.lastMessageBody ? htmlToPlainText(ticket.lastMessageBody) : null}>
                      <Link to={`/tickets/${ticket.id}`} className={styles.ticketCardSubject}>{ticket.subject}</Link>
                    </Tooltip>
                    <div className={styles.ticketCardMeta}>
                      {ticket.requesterName}
                      {ticket.requesterCompany && <span className={styles.muted}> · {ticket.requesterCompany}</span>}
                    </div>
                    {ticket.lastMessageBody && (
                      <div className={styles.ticketCardLastMessage}>
                        {(() => {
                          const plain = htmlToPlainText(ticket.lastMessageBody)
                          return plain.length > 150 ? `${plain.slice(0, 150)}…` : plain
                        })()}
                      </div>
                    )}
                    <div className={styles.ticketCardFooter}>
                      <InlineDropdown
                        value={ticket.priority!}
                        options={Object.values(TicketPriority).map((p) => ({ value: p, label: PRIORITY_LABELS[p], dotClass: PRIORITY_DOT[p] }))}
                        onChange={(v) => priorityMutation.mutate({ id: ticket.id!, p: v as TicketPriority })}
                      />
                      <InlineDropdown
                        value={ticket.type ?? ''}
                        options={[
                          { value: '', label: 'Nincs típus', ...TYPE_ICON[''] },
                          ...Object.values(TicketType).map((t) => ({ value: t, label: TYPE_LABELS[t], ...TYPE_ICON[t] })),
                        ]}
                        onChange={(v) => typeMutation.mutate({ id: ticket.id!, t: v === '' ? null : v as TicketType })}
                      />
                    </div>
                    <div className={styles.mono}>{formatDateTime(ticket.lastMessageAt ?? ticket.createdAt)}</div>
                  </div>
                ))}
              </div>
              <div className={styles.pager}>
                <span className={styles.mono}>{rangeStart}–{rangeEnd} / {totalCount}</span>
                <div className={styles.pagerButtons}>
                  <button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>‹</button>
                  <span className={styles.pagerCurrent}>{page}</span>
                  <span className={styles.muted}>/ {totalPages || 1}</span>
                  <button disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>›</button>
                </div>
              </div>
            </div>
            <FilterPanel
              filter={detailedFilter}
              setFilter={setDetailedFilter}
              users={usersQuery.data ?? []}
              categories={flatCategories}
              companies={companiesQuery.data ?? []}
            />
          </div>
        </div>
      )}
    </div>
  )
}
