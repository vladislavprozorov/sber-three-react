import ThreeScene from "../features/building-3d/ThreeScene"
import StatusFilter from "../features/building-3d/StatusFilter"
import StatusLegend from "../features/building-3d/StatusLegend"
import BuildingInfoPanel from "../features/building-info/BuildingInfoPanel"
import { useBuildingViewer } from "./hooks/useBuildingViewer"

export default function App() {
  const viewer = useBuildingViewer()

  return (
    <div className="layout">
      <main className="scene">
        <ThreeScene
          selectedFloor={viewer.selectedFloor}
          hoveredFloor={viewer.hoveredFloor}
          activeFilter={viewer.activeFilter}
          onFloorSelect={viewer.toggleFloor}
          onFloorHover={viewer.hoverFloor}
          resetToken={viewer.resetToken}
        />
        <StatusFilter activeFilter={viewer.activeFilter} onChange={viewer.setFilter} />
        <button type="button" className="reset-btn glass" onClick={viewer.resetView} title="Общий вид (Esc)" aria-label="Общий вид">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Общий вид</span>
        </button>
        <StatusLegend />
      </main>

      <BuildingInfoPanel
        selectedFloor={viewer.selectedFloor}
        hoveredFloor={viewer.hoveredFloor}
        activeFilter={viewer.activeFilter}
        onSelect={viewer.selectFloor}
        onHover={viewer.hoverFloor}
      />
    </div>
  )
}
