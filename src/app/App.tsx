import { useState } from "react"
import ThreeScene from "../features/building-3d/ThreeScene"
import BuildingInfoPanel from "../features/building-info/BuildingInfoPanel"
import StatusLegend from "../features/building-3d/StatusLegend"

export default function App() {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <ThreeScene onFloorSelect={setSelectedFloor} />
        <StatusLegend />
      </div>

      <BuildingInfoPanel selectedFloor={selectedFloor} />
    </div>
  )
}