import { STATUS_COLORS, STATUS_LABELS, type FloorStatus } from "../building-info/floorService"

type FilterValue = FloorStatus | "all"

type Props = {
  activeFilter: FilterValue
  onChange: (filter: FilterValue) => void
}

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all",      label: "Все" },
  { value: "ready",    label: STATUS_LABELS.ready },
  { value: "building", label: STATUS_LABELS.building },
  { value: "problem",  label: STATUS_LABELS.problem },
]

export default function StatusFilter({ activeFilter, onChange }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 8,
        zIndex: 10,
      }}
    >
      {FILTERS.map(({ value, label }) => {
        const isActive = activeFilter === value
        const color = value === "all" ? "#aaa" : STATUS_COLORS[value as FloorStatus]

        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: `1.5px solid ${isActive ? color : "rgba(255,255,255,0.15)"}`,
              background: isActive ? `${color}22` : "rgba(0,0,0,0.55)",
              color: isActive ? color : "#999",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              transition: "all 0.18s ease",
              outline: "none",
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export type { FilterValue }
