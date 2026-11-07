import type { CSSProperties } from "react"
import { FLOOR_STATUSES, STATUS_COLORS, STATUS_LABELS, type FloorSnapshot } from "../building-info/floorService"
import type { FilterValue } from "./BuildingScene"

type Props = {
  floors: FloorSnapshot[]
  activeFilter: FilterValue
  onChange: (filter: FilterValue) => void
}

export default function StatusFilter({ floors, activeFilter, onChange }: Props) {
  const filters: { value: FilterValue; label: string; color: string; count: number }[] = [
    { value: "all", label: "Все", color: "#cbd5e1", count: floors.length },
    ...FLOOR_STATUSES.map((status) => ({
      value: status,
      label: STATUS_LABELS[status],
      color: STATUS_COLORS[status],
      count: floors.filter((f) => f.status === status).length,
    })),
  ]

  return (
    <div className="status-filter glass" role="radiogroup" aria-label="Фильтр по статусу">
      {filters
        // пустые статусы прячем, но активный фильтр оставляем, чтобы его можно было снять
        .filter((f) => f.value === "all" || f.count > 0 || f.value === activeFilter)
        .map(({ value, label, color, count }) => {
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
