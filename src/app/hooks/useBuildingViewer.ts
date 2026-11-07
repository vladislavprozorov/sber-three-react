import { useCallback, useEffect, useState } from "react"
import type { FilterValue } from "../../features/building-3d/BuildingScene"
import { FLOOR_COUNT } from "../../features/building-info/floorService"

interface BuildingViewerState {
  selectedFloor: number | null
  selectedRoom: number | null
  hoveredFloor: number | null
  activeFilter: FilterValue
  resetToken: number
  selectFloor: (index: number | null) => void
  toggleFloor: (index: number) => void
  selectRoom: (floor: number, room: number | null) => void
  hoverFloor: (index: number | null) => void
  setFilter: (filter: FilterValue) => void
  resetView: () => void
}

export function useBuildingViewer(): BuildingViewerState {
  const [selection, setSelection] = useState<{ floor: number | null; room: number | null }>({ floor: null, room: null })
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all")
  const [resetToken, setResetToken] = useState(0)

  const selectFloor = useCallback((floor: number | null) => {
    setSelection((prev) => (prev.floor === floor ? prev : { floor, room: null }))
  }, [])

  const toggleFloor = useCallback((floor: number) => {
    setSelection((prev) => (prev.floor === floor ? { floor: null, room: null } : { floor, room: null }))
  }, [])

  const selectRoom = useCallback((floor: number, room: number | null) => {
    setSelection((prev) => ({ floor, room: prev.floor === floor && prev.room === room ? null : room }))
  }, [])

  const resetView = useCallback(() => {
    setSelection({ floor: null, room: null })
    setResetToken((t) => t + 1)
  }, [])

  // Клавиатура: ↑/↓ — соседний этаж, Esc — сначала снять выбор квартиры, затем общий вид
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === "Escape") {
        if (selection.room !== null) setSelection({ floor: selection.floor, room: null })
        else resetView()
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        const delta = event.key === "ArrowUp" ? 1 : -1
        setSelection((prev) => {
          const floor =
            prev.floor === null
              ? delta > 0 ? 0 : FLOOR_COUNT - 1
              : Math.min(FLOOR_COUNT - 1, Math.max(0, prev.floor + delta))
          return { floor, room: null }
        })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selection, resetView])

  return {
    selectedFloor: selection.floor,
    selectedRoom: selection.room,
    hoveredFloor,
    activeFilter,
    resetToken,
    selectFloor,
    toggleFloor,
    selectRoom,
    hoverFloor: setHoveredFloor,
    setFilter: setActiveFilter,
    resetView,
  }
}
