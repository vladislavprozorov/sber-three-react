import { STATUS_COLORS, STATUS_LABELS, type FloorStatus } from "../building-info/floorService"

const STATUSES: FloorStatus[] = ["ready", "building", "problem"]

type Props = {
  isMobile?: boolean
}

export default function StatusLegend({ isMobile = false }: Props) {
  if (isMobile) return null

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 10,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "#666",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Статус этажа
      </p>

      {STATUSES.map((status) => (
        <div
          key={status}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: STATUS_COLORS[status],
              flexShrink: 0,
              boxShadow: `0 0 6px ${STATUS_COLORS[status]}88`,
            }}
          />
          <span style={{ color: "#ddd", fontSize: 13 }}>
            {STATUS_LABELS[status]}
          </span>
        </div>
      ))}
    </div>
  )
}
