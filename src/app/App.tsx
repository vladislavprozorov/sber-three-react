import ThreeScene from "../features/building-3d/ThreeScene"
import BuildingInfoPanel from "../features/building-info/BuildingInfoPanel"
import StatusLegend from "../features/building-3d/StatusLegend"
import StatusFilter from "../features/building-3d/StatusFilter"
import { useBuildingViewer } from "./hooks/useBuildingViewer"
import { useIsMobile } from "../shared/hooks/useIsMobile"

export default function App() {
  const { selectedFloor, activeFilter, selectFloor, setFilter } = useBuildingViewer()
  const isMobile = useIsMobile()

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        height: "100vh",
        overflow: "hidden",
        background: "#1e1e1e",
      }}
    >
      {/* 3D сцена */}
      <div
        style={{
          flex: isMobile ? "none" : 1,
          position: "relative",
          height: isMobile ? "65vh" : "100%",
          flexShrink: 0,
        }}
      >
        <ThreeScene onFloorSelect={selectFloor} activeFilter={activeFilter} isMobile={isMobile} />
        <StatusLegend isMobile={isMobile} />
        <StatusFilter activeFilter={activeFilter} onChange={setFilter} />
      </div>

      {/* Панель информации */}
      <div
        style={{
          flex: isMobile ? "none" : "0 0 300px",
          height: isMobile ? "35vh" : "100%",
          overflowY: "auto",
        }}
      >
        <BuildingInfoPanel selectedFloor={selectedFloor} isMobile={isMobile} />
      </div>
    </div>
  )
}