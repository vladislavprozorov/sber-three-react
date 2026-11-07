import ThreeScene from "../features/building-3d/ThreeScene"
import StatusFilter from "../features/building-3d/StatusFilter"
import StatusLegend from "../features/building-3d/StatusLegend"
import BuildingInfoPanel from "../features/building-info/BuildingInfoPanel"
import { getBuildingSummary } from "../features/building-info/floorService"
import Timeline from "../features/timeline/Timeline"
import { useBuildingViewer } from "./hooks/useBuildingViewer"
import { useTimeline } from "./hooks/useTimeline"

export default function App() {
  const viewer = useBuildingViewer()
  const timeline = useTimeline()

  return (
    <div className="layout">
      <main className="scene">
        <ThreeScene
          floors={timeline.floors}
          selectedFloor={viewer.selectedFloor}
          selectedRoom={viewer.selectedRoom}
          focusedArea={viewer.focusedArea}
          hoveredFloor={viewer.hoveredFloor}
          activeFilter={viewer.activeFilter}
          onFloorSelect={viewer.toggleFloor}
          onRoomSelect={viewer.selectRoom}
          onAreaFocus={viewer.focusArea}
          onFloorHover={viewer.hoverFloor}
          resetToken={viewer.resetToken}
        />
        <StatusFilter floors={timeline.floors} activeFilter={viewer.activeFilter} onChange={viewer.setFilter} />
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
        <Timeline
          date={timeline.date}
          playing={timeline.playing}
          isLive={timeline.isLive}
          progress={getBuildingSummary(timeline.floors).totalProgress}
          onSeek={timeline.seek}
          onTogglePlay={timeline.togglePlay}
          onGoLive={timeline.goLive}
        />
      </main>

      <BuildingInfoPanel
        floors={timeline.floors}
        isLive={timeline.isLive}
        selectedFloor={viewer.selectedFloor}
        selectedRoom={viewer.selectedRoom}
        focusedArea={viewer.focusedArea}
        hoveredFloor={viewer.hoveredFloor}
        activeFilter={viewer.activeFilter}
        onSelect={viewer.selectFloor}
        onSelectRoom={viewer.selectRoom}
        onFocusArea={viewer.focusArea}
        onHover={viewer.hoverFloor}
      />
    </div>
  )
}
