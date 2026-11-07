import { useEffect, useRef } from "react"
import { BuildingScene, type FilterValue } from "./BuildingScene"
import { FLOORS, STATUS_COLORS, STATUS_LABELS } from "../building-info/floorService"

type Props = {
  selectedFloor: number | null
  hoveredFloor: number | null
  activeFilter: FilterValue
  onFloorSelect: (floorIndex: number) => void
  onFloorHover: (floorIndex: number | null) => void
  /** Увеличивается при каждом запросе «вернуть общий вид». */
  resetToken: number
}

export default function ThreeScene({
  selectedFloor,
  hoveredFloor,
  activeFilter,
  onFloorSelect,
  onFloorHover,
  resetToken,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<BuildingScene | null>(null)
  const lastHoverRef = useRef<number | null>(null)

  // Создаём сцену один раз
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scene = new BuildingScene(container)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  // Актуальные коллбэки без пересоздания сцены
  useEffect(() => {
    sceneRef.current?.setCallbacks({
      onSelect: onFloorSelect,
      onHover: (index, clientX, clientY) => {
        const tooltip = tooltipRef.current
        const container = containerRef.current
        if (tooltip && container) {
          if (index === null) {
            tooltip.dataset.visible = "false"
          } else {
            const floor = FLOORS[index]
            const rect = container.getBoundingClientRect()
            tooltip.innerHTML = ""
            const dot = document.createElement("span")
            dot.className = "dot"
            dot.style.background = STATUS_COLORS[floor.status]
            tooltip.append(dot, `${floor.label} · ${STATUS_LABELS[floor.status]} · ${floor.progress}%`)
            tooltip.style.transform = `translate(${clientX - rect.left + 14}px, ${clientY - rect.top - 36}px)`
            tooltip.dataset.visible = "true"
          }
        }
        if (lastHoverRef.current !== index) {
          lastHoverRef.current = index
          onFloorHover(index)
        }
      },
    })
  }, [onFloorSelect, onFloorHover])

  useEffect(() => sceneRef.current?.setSelected(selectedFloor), [selectedFloor])
  useEffect(() => sceneRef.current?.setHovered(hoveredFloor), [hoveredFloor])
  useEffect(() => sceneRef.current?.setFilter(activeFilter), [activeFilter])
  useEffect(() => {
    if (resetToken > 0) sceneRef.current?.resetView()
  }, [resetToken])

  return (
    <div ref={containerRef} className="scene-canvas">
      <div ref={tooltipRef} className="scene-tooltip" data-visible="false" role="tooltip" />
    </div>
  )
}
