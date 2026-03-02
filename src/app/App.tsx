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
        overflow: isMobile ? "auto" : "hidden",
      }}
    >
      <div
        style={{
          flex: isMobile ? "none" : 1,
          position: "relative",
          height: isMobile ? "60vh" : "100%",
          minHeight: isMobile ? 300 : undefined,
        }}
      >
        <ThreeScene onFloorSelect={selectFloor} activeFilter={activeFilter} />
        <StatusLegend />
        <StatusFilter activeFilter={activeFilter} onChange={setFilter} />
      </div>

      <BuildingInfoPanel selectedFloor={selectedFloor} isMobile={isMobile} />
    </div>
  )
}