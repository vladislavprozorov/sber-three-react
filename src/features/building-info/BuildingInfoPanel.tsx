import { useEffect, useState } from "react"
import { fetchFloorData, STATUS_COLORS, STATUS_LABELS, type FloorData } from "./floorService"

type Props = {
  selectedFloor: number | null
  isMobile?: boolean
}

function SkeletonLine({ width = "100%" }: { width?: string }) {
  return (
    <div
      style={{
        height: 16,
        width,
        borderRadius: 4,
        background: "linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.2s infinite",
        marginBottom: 10,
      }}
    />
  )
}

export default function BuildingInfoPanel({ selectedFloor, isMobile = false }: Props) {
  const [data, setData] = useState<FloorData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedFloor === null) {
      setData(null)
      return
    }
    setLoading(true)
    setData(null)
    fetchFloorData(selectedFloor).then((result) => {
      setData(result)
      setLoading(false)
    })
  }, [selectedFloor])

  const statusColor = data ? STATUS_COLORS[data.status] : "#888"

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: isMobile ? "12px 16px" : 24,
        background: "#111",
        color: "white",
        fontFamily: "sans-serif",
        borderLeft: isMobile ? "none" : "1px solid #222",
        borderTop: isMobile ? "1px solid #222" : "none",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {selectedFloor === null && (
        <p style={{ color: "#888", marginTop: 0, fontSize: isMobile ? 13 : 14 }}>
          Нажмите на этаж
        </p>
      )}

      {loading && (
        <>
          <SkeletonLine width="60%" />
          <SkeletonLine width="80%" />
          <SkeletonLine width="70%" />
          <SkeletonLine width="50%" />
          <SkeletonLine width="65%" />
        </>
      )}

      {!loading && data && (
        <>
          <h2 style={{ margin: isMobile ? "0 0 8px" : "0 0 16px", fontSize: isMobile ? 15 : 18 }}>{data.label}</h2>

          <div style={{ marginBottom: isMobile ? 6 : 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: statusColor,
                flexShrink: 0,
              }}
            />
            <span style={{ color: statusColor, fontWeight: 600 }}>
              {STATUS_LABELS[data.status]}
            </span>
          </div>

          <Row label="Прогресс">
            <div style={{ background: "#222", borderRadius: 4, overflow: "hidden", height: 8, flex: 1 }}>
              <div
                style={{
                  width: `${data.progress}%`,
                  height: "100%",
                  background: statusColor,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <span style={{ marginLeft: 8, fontSize: 12, color: "#aaa" }}>{data.progress}%</span>
          </Row>

          <InfoRow label="Площадь"    value={`${data.area} м²`} />
          <InfoRow label="Подрядчик"  value={data.contractor} />
        </>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p style={{ margin: "8px 0", fontSize: 14, color: "#ccc" }}>
      <span style={{ color: "#666" }}>{label}: </span>
      {value}
    </p>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: "8px 0", fontSize: 14, color: "#ccc" }}>
      <div style={{ color: "#666", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center" }}>{children}</div>
    </div>
  )
}