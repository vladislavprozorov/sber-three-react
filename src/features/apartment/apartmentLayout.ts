import type { RoomSnapshot } from "../building-info/floorService"

/**
 * Планировка квартиры в метрах, в локальной системе координат:
 *   x — вдоль фасада, z = -depth/2 — фасад с окнами, z = +depth/2 — стена к коридору (вход).
 * Сцена масштабирует метры в свои единицы через METER.
 */

/** Сколько единиц сцены в одном метре. */
export const METER = 0.2
export const CEILING = 2.6

export type RoomKind = "living" | "bedroom" | "kitchen" | "kitchen-living" | "bath" | "hall"

export interface ApartmentRoom {
  name: string
  kind: RoomKind
  x0: number
  x1: number
  z0: number
  z1: number
  /** Площадь по экспликации, м² */
  area: number
}

export interface WallGap {
  /** Центр проёма вдоль оси стены */
  at: number
  width: number
  kind: "door" | "window"
}

export interface WallSegment {
  /** horizontal: стена вдоль x на высоте z = fixed; vertical: вдоль z при x = fixed */
  axis: "x" | "z"
  fixed: number
  from: number
  to: number
  outer: boolean
  gaps: WallGap[]
}

export interface ApartmentLayout {
  width: number
  depth: number
  rooms: ApartmentRoom[]
  walls: WallSegment[]
}

type Cell = [kind: RoomKind, name: string, fraction: number]

const TEMPLATES: Record<string, { front: Cell[]; back: Cell[] }> = {
  "1-комн.": {
    front: [["kitchen", "Кухня", 0.42], ["living", "Комната", 0.58]],
    back: [["bath", "Санузел", 0.45], ["hall", "Прихожая", 0.55]],
  },
  "2-комн.": {
    front: [["kitchen-living", "Кухня-гостиная", 0.56], ["bedroom", "Спальня", 0.44]],
    back: [["hall", "Прихожая", 0.55], ["bath", "Санузел", 0.45]],
  },
  "3-комн.": {
    front: [["bedroom", "Спальня", 0.32], ["living", "Гостиная", 0.36], ["bedroom", "Детская", 0.32]],
    back: [["kitchen", "Кухня", 0.42], ["hall", "Прихожая", 0.3], ["bath", "Санузел", 0.28]],
  },
}

/** Доля глубины квартиры, которую занимают жилые комнаты у фасада. */
const FRONT_SHARE = 0.6
const DOOR = 0.85
const ENTRANCE = 0.95

function splitBand(cells: Cell[], width: number, z0: number, z1: number): ApartmentRoom[] {
  let x = -width / 2
  return cells.map(([kind, name, fraction]) => {
    const w = width * fraction
    const room = { name, kind, x0: x, x1: x + w, z0, z1, area: 0 }
    x += w
    return room
  })
}

const cache = new Map<string, ApartmentLayout>()

export function getApartmentLayout(apartment: RoomSnapshot): ApartmentLayout {
  const key = `${apartment.type}|${apartment.width}|${apartment.depth}|${apartment.area}`
  const cached = cache.get(key)
  if (cached) return cached

  const template = TEMPLATES[apartment.type] ?? TEMPLATES["1-комн."]
  const width = apartment.width / METER
  const depth = apartment.depth / METER
  const zFacade = -depth / 2
  const zCorridor = depth / 2
  const zSplit = zFacade + depth * FRONT_SHARE

  const front = splitBand(template.front, width, zFacade, zSplit)
  const back = splitBand(template.back, width, zSplit, zCorridor)
  const rooms = [...front, ...back]

  // Площади по экспликации приводим к площади квартиры из базы (стены «съедают» часть метров)
  const geometric = rooms.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0)
  for (const room of rooms) {
    room.area = Math.round(((room.x1 - room.x0) * (room.z1 - room.z0) * apartment.area) / geometric * 10) / 10
  }

  const hall = back.find((r) => r.kind === "hall")!
  const hallCenter = (hall.x0 + hall.x1) / 2
  const walls: WallSegment[] = []

  // Фасад: по окну в каждой жилой комнате
  walls.push({
    axis: "x",
    fixed: zFacade,
    from: -width / 2,
    to: width / 2,
    outer: true,
    gaps: front.map((r) => ({
      at: (r.x0 + r.x1) / 2,
      width: Math.min(1.8, (r.x1 - r.x0) * 0.5),
      kind: "window" as const,
    })),
  })
  // Стена к коридору: входная дверь в прихожую
  walls.push({
    axis: "x",
    fixed: zCorridor,
    from: -width / 2,
    to: width / 2,
    outer: true,
    gaps: [{ at: hallCenter, width: ENTRANCE, kind: "door" }],
  })
  // Торцевые стены
  for (const x of [-width / 2, width / 2]) {
    walls.push({ axis: "z", fixed: x, from: zFacade, to: zCorridor, outer: true, gaps: [] })
  }

  // Стена между жилыми комнатами и «служебной» зоной: двери как можно ближе к прихожей
  walls.push({
    axis: "x",
    fixed: zSplit,
    from: -width / 2,
    to: width / 2,
    outer: false,
    gaps: front.map((r) => ({
      at: Math.min(r.x1 - DOOR / 2 - 0.2, Math.max(r.x0 + DOOR / 2 + 0.2, hallCenter)),
      width: DOOR,
      kind: "door" as const,
    })),
  })

  // Перегородки между комнатами
  for (let i = 1; i < front.length; i++) {
    walls.push({ axis: "z", fixed: front[i].x0, from: zFacade, to: zSplit, outer: false, gaps: [] })
  }
  for (let i = 1; i < back.length; i++) {
    const touchesHall = back[i].kind === "hall" || back[i - 1].kind === "hall"
    walls.push({
      axis: "z",
      fixed: back[i].x0,
      from: zSplit,
      to: zCorridor,
      outer: false,
      gaps: touchesHall ? [{ at: (zSplit + zCorridor) / 2, width: DOOR, kind: "door" }] : [],
    })
  }

  const layout = { width, depth, rooms, walls }
  cache.set(key, layout)
  return layout
}

// ───────────────────────── Этапы строительства ─────────────────────────

export interface ConstructionStage {
  name: string
  progress: number
}

const STAGES: [name: string, from: number, to: number][] = [
  ["Стены и перегородки", 0, 45],
  ["Окна и инженерные сети", 45, 70],
  ["Чистовая отделка", 70, 95],
  ["Меблировка и сдача", 95, 100],
]

export function getConstructionStages(progress: number): ConstructionStage[] {
  return STAGES.map(([name, from, to]) => ({
    name,
    progress: Math.round(Math.min(1, Math.max(0, (progress - from) / (to - from))) * 100),
  }))
}

/** Что уже есть в квартире при данном прогрессе — общая логика для 3D и панели. */
export function getBuildState(progress: number) {
  return {
    /** Доля высоты стен (0 — только разметка на полу) */
    wallHeight: progress <= 0 ? 0 : Math.min(1, 0.15 + (progress / 45) * 0.85),
    windows: progress >= 55,
    plaster: progress >= 70,
    floorFinish: progress >= 85,
    furniture: progress >= 100,
  }
}
