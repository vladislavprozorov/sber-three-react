import { useState } from "react"
import type { FilterValue } from "../../features/building-3d/StatusFilter"

interface BuildingViewerState {
  selectedFloor: number | null
  activeFilter: FilterValue
  selectFloor: (index: number) => void
  setFilter: (filter: FilterValue) => void
}

export function useBuildingViewer(): BuildingViewerState {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all")

  return {
    selectedFloor,
    activeFilter,
    selectFloor: setSelectedFloor,
    setFilter: setActiveFilter,
  }
}
