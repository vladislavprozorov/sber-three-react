import { useEffect, useRef, useState } from "react"
import { BuildingScene, type FilterValue, type HoverTarget } from "./BuildingScene"
import { STATUS_COLORS, STATUS_LABELS, type FloorSnapshot } from "../building-info/floorService"

type Props = {
  floors: FloorSnapshot[]
  selectedFloor: number | null
  selectedRoom: number | null
  hoveredFloor: number | null
  activeFilter: FilterValue
  onFloorSelect: (floorIndex: number) => void
  onRoomSelect: (floorIndex: number, roomIndex: number) => void
  onFloorHover: (floorIndex: number | null) => void
  /** Увеличивается при каждом запросе «вернуть общий вид». */
  resetToken: number
}

function tooltipContent(floors: FloorSnapshot[], target: HoverTarget) {
  const floor = floors[target.floor]
  if (target.room !== null) {
    const room = floor.rooms[target.room]
    return { status: room.status, text: `Кв. ${room.number} · ${room.type} · ${room.area} м² · ${room.progress}%` }
  }
  return { status: floor.status, text: `${floor.label} · ${STATUS_LABELS[floor.status]} · ${floor.progress}%` }
}

export default function ThreeScene({
  floors,
  selectedFloor,
  selectedRoom,
  hoveredFloor,
  activeFilter,
  onFloorSelect,
  onRoomSelect,
  onFloorHover,
  resetToken,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<BuildingScene | null>(null)
  const lastHoverRef = useRef<number | null>(null)
  // Начальный снимок нужен только для построения геометрии
  const [initialFloors] = useState(floors)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scene = new BuildingScene(container, initialFloors)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [initialFloors])

  // Актуальные коллбэки без пересоздания сцены
  useEffect(() => {
    sceneRef.current?.setCallbacks({
      onSelectFloor: onFloorSelect,
      onSelectRoom: onRoomSelect,
      onHover: (target, clientX, clientY) => {
        const tooltip = tooltipRef.current
        const container = containerRef.current
        if (tooltip && container) {
          if (target === null) {
            tooltip.dataset.visible = "false"
          } else {
            const { status, text } = tooltipContent(floors, target)
            const rect = container.getBoundingClientRect()
            const dot = document.createElement("span")
            dot.className = "dot"
            dot.style.background = STATUS_COLORS[status]
            tooltip.replaceChildren(dot, text)
            tooltip.style.transform = `translate(${clientX - rect.left + 14}px, ${clientY - rect.top - 36}px)`
            tooltip.dataset.visible = "true"
          }
        }
        const floor = target?.floor ?? null
        if (lastHoverRef.current !== floor) {
          lastHoverRef.current = floor
          onFloorHover(floor)
        }
      },
    })
  }, [floors, onFloorSelect, onRoomSelect, onFloorHover])

  useEffect(() => sceneRef.current?.setFloors(floors), [floors])
  useEffect(() => sceneRef.current?.setSelected(selectedFloor), [selectedFloor])
  useEffect(() => sceneRef.current?.setSelectedRoom(selectedRoom), [selectedRoom])
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
