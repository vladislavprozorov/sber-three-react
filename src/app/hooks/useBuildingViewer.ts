import { useCallback, useEffect, useState } from "react"
import type { FilterValue } from "../../features/building-3d/BuildingScene"
import { FLOORS } from "../../features/building-info/floorService"

interface BuildingViewerState {
  selectedFloor: number | null
  hoveredFloor: number | null
  activeFilter: FilterValue
  resetToken: number
  selectFloor: (index: number | null) => void
  toggleFloor: (index: number) => void
  hoverFloor: (index: number | null) => void
  setFilter: (filter: FilterValue) => void
  resetView: () => void
}

export function useBuildingViewer(): BuildingViewerState {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all")
  const [resetToken, setResetToken] = useState(0)

  const toggleFloor = useCallback((index: number) => {
    setSelectedFloor((prev) => (prev === index ? null : index))
  }, [])

  const resetView = useCallback(() => {
    setSelectedFloor(null)
    setResetToken((t) => t + 1)
  }, [])

  // Клавиатура: ↑/↓ — соседний этаж, Esc — общий вид
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === "Escape") {
        resetView()
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        const delta = event.key === "ArrowUp" ? 1 : -1
        setSelectedFloor((prev) => {
          if (prev === null) return delta > 0 ? 0 : FLOORS.length - 1
          return Math.min(FLOORS.length - 1, Math.max(0, prev + delta))
        })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resetView])

  return {
    selectedFloor,
    hoveredFloor,
    activeFilter,
    resetToken,
    selectFloor: setSelectedFloor,
    toggleFloor,
    hoverFloor: setHoveredFloor,
    setFilter: setActiveFilter,
    resetView,
  }
}
