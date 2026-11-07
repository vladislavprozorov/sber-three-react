import { useEffect, useRef, type CSSProperties } from "react"
import { STATUS_COLORS, STATUS_LABELS, type RoomSnapshot } from "../building-info/floorService"
import { getApartmentLayout, getConstructionStages, type RoomKind } from "./apartmentLayout"

type Props = {
  apartment: RoomSnapshot
  onClose: () => void
}

const ROOM_FILL: Record<RoomKind, string> = {
  living: "#a78bfa",
  bedroom: "#60a5fa",
  kitchen: "#fbbf24",
  "kitchen-living": "#fbbf24",
  bath: "#22d3ee",
  hall: "#94a3b8",
}

/** Карточка квартиры: мини-план, экспликация помещений и этапы работ. */
export default function ApartmentCard({ apartment, onClose }: Props) {
  const layout = getApartmentLayout(apartment)
  const stages = getConstructionStages(apartment.progress)
  const color = STATUS_COLORS[apartment.status]
  const pad = 0.4
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [])

  return (
    <div ref={ref} className="apartment fade-in" style={{ "--status-color": color } as CSSProperties}>
      <div className="apartment-head">
        <div>
          <strong className="apartment-title">Квартира {apartment.number}</strong>
          <span className="muted">
            {apartment.type} · {apartment.area} м²
          </span>
        </div>
        <span className="badge">
          <span className="dot" style={{ background: color }} />
          {STATUS_LABELS[apartment.status]}
        </span>
        <button type="button" className="icon-btn" aria-label="Закрыть квартиру" title="Назад к этажу (Esc)" onClick={onClose}>
          ✕
        </button>
      </div>

      <svg
        className="apartment-plan"
        viewBox={`${-layout.width / 2 - pad} ${-layout.depth / 2 - pad} ${layout.width + pad * 2} ${layout.depth + pad * 2}`}
        role="img"
        aria-label={`План квартиры ${apartment.number}`}
      >
        {layout.rooms.map((room) => (
          <g key={room.name + room.x0}>
            <rect
              x={room.x0}
              y={room.z0}
              width={room.x1 - room.x0}
              height={room.z1 - room.z0}
              fill={ROOM_FILL[room.kind]}
              fillOpacity={0.16}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={0.06}
            />
            <text x={(room.x0 + room.x1) / 2} y={(room.z0 + room.z1) / 2} className="apartment-plan-name">
              {room.name}
            </text>
            <text x={(room.x0 + room.x1) / 2} y={(room.z0 + room.z1) / 2 + 0.55} className="apartment-plan-area">
              {room.area} м²
            </text>
          </g>
        ))}
        {/* окна на фасаде и входная дверь */}
        {layout.walls.flatMap((wall, i) =>
          wall.axis === "x" && wall.outer
            ? wall.gaps.map((gap, j) => (
                <line
                  key={`${i}-${j}`}
                  x1={gap.at - gap.width / 2}
                  x2={gap.at + gap.width / 2}
                  y1={wall.fixed}
                  y2={wall.fixed}
                  stroke={gap.kind === "window" ? "#7dd3fc" : "#f8fafc"}
                  strokeWidth={gap.kind === "window" ? 0.22 : 0.12}
                  strokeDasharray={gap.kind === "door" ? "0.15 0.1" : undefined}
                />
              ))
            : [],
        )}
        <text x={0} y={-layout.depth / 2 - 0.12} className="apartment-plan-side">окна</text>
        <text x={0} y={layout.depth / 2 + 0.32} className="apartment-plan-side">вход из коридора</text>
      </svg>

      <h4 className="mini-title">Экспликация</h4>
      <ul className="explication">
        {layout.rooms.map((room) => (
          <li key={room.name + room.x0}>
            <span className="dot" style={{ background: ROOM_FILL[room.kind] }} />
            <span>{room.name}</span>
            <span className="muted">{room.area} м²</span>
          </li>
        ))}
      </ul>

      <h4 className="mini-title">Этапы работ · {apartment.progress}%</h4>
      <ol className="stages">
        {stages.map((stage) => (
          <li key={stage.name} data-state={stage.progress >= 100 ? "done" : stage.progress > 0 ? "active" : "todo"}>
            <span className="stage-mark" aria-hidden="true">
              {stage.progress >= 100 ? "✓" : ""}
            </span>
            <span className="stage-body">
              <span className="stage-name">
                {stage.name}
                <span className="muted">{stage.progress}%</span>
              </span>
              <span className="progress">
                <span className="progress-fill" style={{ width: `${stage.progress}%`, background: color }} />
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
