import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import FloorPlan from "./FloorPlan"
import {
  FLOOR_STATUSES,
  PROJECT_NAME,
  STATUS_COLORS,
  STATUS_LABELS,
  getBuildingSummary,
  type FloorSnapshot,
  type FloorStatus,
} from "./floorService"
import { useFloorDetails } from "./hooks/useFloorDetails"

type Props = {
  floors: FloorSnapshot[]
  isLive: boolean
  selectedFloor: number | null
  selectedRoom: number | null
  focusedArea: number | null
  hoveredFloor: number | null
  activeFilter: FloorStatus | "all"
  onSelect: (floorIndex: number | null) => void
  onSelectRoom: (floorIndex: number, roomIndex: number | null) => void
  onFocusArea: (areaIndex: number | null) => void
  onHover: (floorIndex: number | null) => void
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" })
const numberFormat = new Intl.NumberFormat("ru-RU")

export default function BuildingInfoPanel({
  floors,
  isLive,
  selectedFloor,
  selectedRoom,
  focusedArea,
  hoveredFloor,
  activeFilter,
  onSelect,
  onSelectRoom,
  onFocusArea,
  onHover,
}: Props) {
  const summary = getBuildingSummary(floors)
  // Сверху вниз, как в реальном здании
  const floorsTopDown = [...floors].reverse()

  return (
    <aside className="panel">
      <header className="panel-header">
        <p className="eyebrow">Объект строительства</p>
        <h1 className="panel-title">{PROJECT_NAME}</h1>

        <div className="summary">
          <ProgressRing value={summary.totalProgress} />
          <div className="summary-stats">
            {FLOOR_STATUSES.filter((status) => status !== "planned" || summary.counts.planned > 0).map((status) => (
              <div key={status} className="summary-stat">
                <span className="dot" style={{ background: STATUS_COLORS[status] }} />
                <span className="muted">{STATUS_LABELS[status]}</span>
                <strong>{summary.counts[status]}</strong>
              </div>
            ))}
            <div className="summary-stat">
              <span className="muted">Площадь</span>
              <strong>{numberFormat.format(summary.totalArea)} м²</strong>
            </div>
          </div>
        </div>
      </header>

      {selectedFloor !== null && (
        <FloorDetailsCard
          key={selectedFloor}
          floor={floors[selectedFloor]}
          isLive={isLive}
          selectedRoom={selectedRoom}
          focusedArea={focusedArea}
          onSelectRoom={(room) => onSelectRoom(selectedFloor, room)}
          onFocusArea={onFocusArea}
          onClose={() => onSelect(null)}
          onPrev={selectedFloor > 0 ? () => onSelect(selectedFloor - 1) : undefined}
          onNext={selectedFloor < floors.length - 1 ? () => onSelect(selectedFloor + 1) : undefined}
        />
      )}

      <section className="floor-list-section">
        <h2 className="section-title">Этажи</h2>
        <ul className="floor-list" onMouseLeave={() => onHover(null)}>
          {floorsTopDown.map((floor) => {
            const dimmed = activeFilter !== "all" && floor.status !== activeFilter
            const color = STATUS_COLORS[floor.status]
            return (
              <li key={floor.floorIndex}>
                <button
                  type="button"
                  className="floor-row"
                  data-selected={floor.floorIndex === selectedFloor}
                  data-hovered={floor.floorIndex === hoveredFloor}
                  data-dimmed={dimmed}
                  style={{ "--status-color": color } as CSSProperties}
                  onClick={() => onSelect(floor.floorIndex === selectedFloor ? null : floor.floorIndex)}
                  onMouseEnter={() => onHover(floor.floorIndex)}
                  onFocus={() => onHover(floor.floorIndex)}
                  onBlur={() => onHover(null)}
                >
                  <span className="floor-num">{floor.floorIndex + 1}</span>
                  <span className="floor-row-body">
                    <span className="floor-row-top">
                      <span>{floor.label}</span>
                      <span className="floor-row-status" style={{ color }}>
                        {STATUS_LABELS[floor.status]}
                      </span>
                    </span>
                    <ProgressBar value={floor.progress} color={color} />
                  </span>
                  <span className="floor-row-pct">{floor.progress}%</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}

function FloorDetailsCard({
  floor,
  isLive,
  selectedRoom,
  focusedArea,
  onSelectRoom,
  onFocusArea,
  onClose,
  onPrev,
  onNext,
}: {
  floor: FloorSnapshot
  isLive: boolean
  selectedRoom: number | null
  focusedArea: number | null
  onSelectRoom: (room: number | null) => void
  onFocusArea: (area: number | null) => void
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const { data, loading, error } = useFloorDetails(floor.floorIndex)
  const color = STATUS_COLORS[floor.status]
  const cardRef = useRef<HTMLElement | null>(null)

  // Карточка монтируется заново для каждого этажа — прокручиваем панель к ней
  useEffect(() => {
    cardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [])

  return (
    <section ref={cardRef} className="details" style={{ "--status-color": color } as CSSProperties} aria-live="polite">
      <div className="details-head">
        <div>
          <h2 className="details-title">{floor.label}</h2>
          <span className="badge">
            <span className="dot" style={{ background: color }} />
            {STATUS_LABELS[floor.status]}
          </span>
        </div>
        <div className="details-nav">
          <IconButton label="Этаж ниже" onClick={onPrev}>↓</IconButton>
          <IconButton label="Этаж выше" onClick={onNext}>↑</IconButton>
          <IconButton label="Закрыть" onClick={onClose}>✕</IconButton>
        </div>
      </div>

      <div className="details-progress">
        <div className="details-progress-label">
          <span className="muted">Готовность</span>
          <strong>{floor.progress}%</strong>
        </div>
        <ProgressBar value={floor.progress} color={color} large />
      </div>

      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="details-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="stat">
              <div className="skeleton" style={{ width: "50%" }} />
              <div className="skeleton" style={{ width: "80%", height: 18 }} />
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="details-grid fade-in">
            <Stat label="Площадь" value={`${numberFormat.format(data.area)} м²`} />
            <Stat label="Рабочих на объекте" value={String(data.workers)} />
            <Stat label="Подрядчик" value={data.contractor} />
            <Stat label="Срок сдачи" value={dateFormat.format(new Date(`${data.deadline}T00:00:00`))} />
          </div>
          {data.note && isLive && floor.status === "problem" && (
            <p className="note fade-in">
              <span aria-hidden="true">⚠</span> {data.note}
            </p>
          )}
        </>
      )}

      <h3 className="section-title plan-title">Планировка</h3>
      <FloorPlan
        rooms={floor.rooms}
        selectedRoom={selectedRoom}
        focusedArea={focusedArea}
        onSelect={onSelectRoom}
        onFocusArea={onFocusArea}
      />
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick} disabled={!onClick}>
      {children}
    </button>
  )
}

function ProgressBar({ value, color, large = false }: { value: number; color: string; large?: boolean }) {
  return (
    <span className="progress" data-large={large} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className="progress-fill" style={{ width: `${value}%`, background: color }} />
    </span>
  )
}

function ProgressRing({ value }: { value: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="ring" role="img" aria-label={`Общая готовность ${value}%`}>
      <svg viewBox="0 0 80 80" width="88" height="88">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div className="ring-label">
        <strong>{value}%</strong>
        <span>готово</span>
      </div>
    </div>
  )
}
