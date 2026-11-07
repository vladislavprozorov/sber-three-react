import ApartmentCard from "../apartment/ApartmentCard"
import { FLOOR_FOOTPRINT, STATUS_COLORS, STATUS_LABELS, type RoomSnapshot } from "./floorService"

type Props = {
  rooms: RoomSnapshot[]
  selectedRoom: number | null
  focusedArea: number | null
  onSelect: (roomIndex: number | null) => void
  onFocusArea: (areaIndex: number | null) => void
}

const PAD = 0.12
const W = FLOOR_FOOTPRINT.width
const D = FLOOR_FOOTPRINT.depth

/** Интерактивная 2D-планировка этажа — зеркало раскрытого этажа в 3D. */
export default function FloorPlan({ rooms, selectedRoom, focusedArea, onSelect, onFocusArea }: Props) {
  const selected = selectedRoom !== null ? rooms[selectedRoom] : null

  return (
    <div className="plan">
      <svg
        className="plan-svg"
        viewBox={`${-W / 2 - PAD} ${-D / 2 - PAD} ${W + PAD * 2} ${D + PAD * 2}`}
        role="group"
        aria-label="Планировка этажа"
      >
        <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.08} className="plan-outline" />
        <text x={0} y={0.06} className="plan-corridor">коридор</text>
        {rooms.map((room) => {
          const isSelected = room.roomIndex === selectedRoom
          const color = STATUS_COLORS[room.status]
          return (
            <g
              key={room.roomIndex}
              className="plan-room"
              data-selected={isSelected}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Квартира ${room.number}, ${room.type}, ${STATUS_LABELS[room.status]}`}
              onClick={() => onSelect(isSelected ? null : room.roomIndex)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(isSelected ? null : room.roomIndex)
                }
              }}
            >
              <rect
                x={room.x - room.width / 2 + 0.05}
                y={room.z - room.depth / 2 + 0.05}
                width={room.width - 0.1}
                height={room.depth - 0.1}
                rx={0.06}
                fill={color}
                fillOpacity={isSelected ? 0.55 : 0.22}
                stroke={color}
                strokeOpacity={isSelected ? 1 : 0.6}
              />
              {/* полоска прогресса внизу квартиры */}
              <rect
                x={room.x - room.width / 2 + 0.15}
                y={room.z + room.depth / 2 - 0.25}
                width={(room.width - 0.3) * (room.progress / 100)}
                height={0.06}
                rx={0.03}
                fill={color}
              />
              <text x={room.x} y={room.z - 0.05} className="plan-number">{room.number}</text>
              <text x={room.x} y={room.z + 0.28} className="plan-type">{room.type}</text>
            </g>
          )
        })}
      </svg>

      {selected ? (
        <ApartmentCard
          key={selected.number}
          apartment={selected}
          focusedArea={focusedArea}
          onFocusArea={onFocusArea}
          onClose={() => onSelect(null)}
        />
      ) : (
        <p className="plan-hint muted">Выберите квартиру, чтобы заглянуть внутрь</p>
      )}
    </div>
  )
}
