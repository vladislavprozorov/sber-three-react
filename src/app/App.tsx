import { useState } from "react"
import ThreeScene from "../features/building-3d/ThreeScene"
import BuildingInfoPanel from "../features/building-info/BuildingInfoPanel"
import StatusLegend from "../features/building-3d/StatusLegend"
import StatusFilter, { type FilterValue } from "../features/building-3d/StatusFilter"

export default function App() {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all")

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <ThreeScene onFloorSelect={setSelectedFloor} activeFilter={activeFilter} />
        <StatusLegend />
        <StatusFilter activeFilter={activeFilter} onChange={setActiveFilter} />
      </div>

      <BuildingInfoPanel selectedFloor={selectedFloor} />
    </div>
  )
}