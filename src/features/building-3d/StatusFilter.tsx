import type { CSSProperties } from "react"
import { FLOOR_STATUSES, FLOORS, STATUS_COLORS, STATUS_LABELS } from "../building-info/floorService"
import type { FilterValue } from "./BuildingScene"

type Props = {
  activeFilter: FilterValue
  onChange: (filter: FilterValue) => void
}

const FILTERS: { value: FilterValue; label: string; color: string; count: number }[] = [
  { value: "all", label: "Все", color: "#cbd5e1", count: FLOORS.length },
  ...FLOOR_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
    count: FLOORS.filter((f) => f.status === status).length,
  })),
]

export default function StatusFilter({ activeFilter, onChange }: Props) {
  return (
    <div className="status-filter glass" role="radiogroup" aria-label="Фильтр по статусу">
      {FILTERS.map(({ value, label, color, count }) => {
        const isActive = activeFilter === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className="chip"
            data-active={isActive}
            style={{ "--chip-color": color } as CSSProperties}
            onClick={() => onChange(value)}
          >
            {value !== "all" && <span className="dot" style={{ background: color }} />}
            {label}
            <span className="chip-count">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
