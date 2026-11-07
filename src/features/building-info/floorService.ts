export type FloorStatus = "ready" | "building" | "problem" | "planned"

/** Помещение (квартира) на этаже. Координаты — в метрах сцены относительно центра этажа. */
export interface RoomSnapshot {
  roomIndex: number
  number: string
  type: string
  area: number
  status: FloorStatus
  progress: number
  x: number
  z: number
  width: number
  depth: number
}

/** Состояние этажа на конкретную дату — нужно сцене, списку и плану. */
export interface FloorSnapshot {
  floorIndex: number
  label: string
  status: FloorStatus
  progress: number
  rooms: RoomSnapshot[]
}

/** Неизменные паспортные данные этажа — «загружаются» с сервера по запросу. */
export interface FloorDetails {
  floorIndex: number
  area: number
  contractor: string
  workers: number
  deadline: string
  note?: string
}

interface FloorRecord extends FloorDetails {
  label: string
  startedAt: string
  /** Дата завершения — только для уже готовых этажей. */
  finishedAt?: string
  /** Текущий (на сегодня) прогресс незавершённого этажа. */
  progress: number
  problemSince?: string
}

const DAY = 24 * 60 * 60 * 1000

export function parseDate(value: string): number {
  return new Date(`${value}T00:00:00`).getTime()
}

export const PROJECT_START = parseDate("2025-09-01")
export const TODAY = parseDate("2026-11-07")
export const PROJECT_NAME = "ЖК «Северный квартал»"

const floorsDb: FloorRecord[] = [
  { floorIndex: 0, label: "1-й этаж", startedAt: "2025-09-01", finishedAt: "2026-01-20", progress: 100, area: 520, contractor: "СтройГрупп", workers: 0,  deadline: "2026-03-15" },
  { floorIndex: 1, label: "2-й этаж", startedAt: "2025-11-01", finishedAt: "2026-03-30", progress: 100, area: 480, contractor: "СтройГрупп", workers: 0,  deadline: "2026-04-20" },
  { floorIndex: 2, label: "3-й этаж", startedAt: "2026-01-10", finishedAt: "2026-05-25", progress: 100, area: 480, contractor: "СтройГрупп", workers: 2,  deadline: "2026-05-30" },
  { floorIndex: 3, label: "4-й этаж", startedAt: "2026-03-01", progress: 85, area: 480, contractor: "МегаСтрой",  workers: 14, deadline: "2026-12-01" },
  { floorIndex: 4, label: "5-й этаж", startedAt: "2026-04-15", progress: 40, area: 480, contractor: "МегаСтрой",  workers: 6,  deadline: "2026-10-15", problemSince: "2026-08-20", note: "Задержка поставки арматуры, срок сорван на 3 недели" },
  { floorIndex: 5, label: "6-й этаж", startedAt: "2026-06-01", progress: 55, area: 460, contractor: "АльфаСтрой", workers: 18, deadline: "2027-01-20" },
  { floorIndex: 6, label: "7-й этаж", startedAt: "2026-08-01", progress: 25, area: 460, contractor: "АльфаСтрой", workers: 11, deadline: "2027-03-10" },
  { floorIndex: 7, label: "8-й этаж", startedAt: "2026-09-20", progress: 10, area: 440, contractor: "АльфаСтрой", workers: 3,  deadline: "2027-04-25", problemSince: "2026-10-25", note: "Замечания стройнадзора по опалубке" },
]

export const FLOOR_COUNT = floorsDb.length

export const FLOOR_STATUSES: FloorStatus[] = ["ready", "building", "problem", "planned"]

export const STATUS_COLORS: Record<FloorStatus, string> = {
  ready:    "#22c55e",
  building: "#f59e0b",
  problem:  "#ef4444",
  planned:  "#64748b",
}

export const STATUS_LABELS: Record<FloorStatus, string> = {
  ready:    "Готов",
  building: "Строится",
  problem:  "Проблема",
  planned:  "Не начат",
}

// ───────────────────────── Планировка ─────────────────────────

/** Габариты этажа в единицах сцены (должны совпадать с BuildingScene). */
export const FLOOR_FOOTPRINT = { width: 5, depth: 4 } as const

const CORRIDOR = 0.7
const ROW_DEPTH = (FLOOR_FOOTPRINT.depth - CORRIDOR) / 2
const COLUMN_WIDTHS = [1.5, 1, 1, 1.5]
const COLUMN_TYPES = ["3-комн.", "1-комн.", "2-комн.", "3-комн."]

/** Две линии квартир по 4 штуки с коридором посередине. Порядок — порядок строительства. */
const ROOM_LAYOUT = (() => {
  const rooms: { x: number; z: number; width: number; depth: number; type: string }[] = []
  // Северная линия слева направо, южная — обратно («змейкой», как идёт бригада)
  for (const row of [-1, 1]) {
    const columns = row < 0 ? [0, 1, 2, 3] : [3, 2, 1, 0]
    for (const column of columns) {
      const left = -FLOOR_FOOTPRINT.width / 2 + COLUMN_WIDTHS.slice(0, column).reduce((a, b) => a + b, 0)
      const width = COLUMN_WIDTHS[column]
      rooms.push({
        x: left + width / 2,
        z: row * (CORRIDOR / 2 + ROW_DEPTH / 2),
        width,
        depth: ROW_DEPTH,
        type: COLUMN_TYPES[column],
      })
    }
  }
  return rooms
})()

const LAYOUT_AREA = ROOM_LAYOUT.reduce((sum, r) => sum + r.width * r.depth, 0)

function buildRooms(record: FloorRecord, progress: number, status: FloorStatus): RoomSnapshot[] {
  const n = ROOM_LAYOUT.length
  const filled = (progress / 100) * n
  const problemRoom = status === "problem" ? Math.min(n - 1, Math.floor(filled)) : -1

  return ROOM_LAYOUT.map((cell, i) => {
    const roomProgress = Math.round(Math.min(1, Math.max(0, filled - i)) * 100)
    let roomStatus: FloorStatus = roomProgress >= 100 ? "ready" : roomProgress > 0 ? "building" : "planned"
    if (i === problemRoom) roomStatus = "problem"
    return {
      roomIndex: i,
      number: `${record.floorIndex + 1}${String(i + 1).padStart(2, "0")}`,
      type: cell.type,
      area: Math.round(((cell.width * cell.depth) / LAYOUT_AREA) * record.area * 0.85 * 10) / 10,
      status: roomStatus,
      progress: roomProgress,
      x: cell.x,
      z: cell.z,
      width: cell.width,
      depth: cell.depth,
    }
  })
}

// ───────────────────────── История ─────────────────────────

function progressAt(record: FloorRecord, date: number): number {
  const start = parseDate(record.startedAt)
  if (date < start) return 0
  const end = record.finishedAt ? parseDate(record.finishedAt) : TODAY
  const endProgress = record.finishedAt ? 100 : record.progress
  if (date >= end) return endProgress
  // минимум 1%, чтобы начатый этаж не считался «не начатым»
  return Math.max(1, Math.round(((date - start) / (end - start)) * endProgress))
}

function statusAt(record: FloorRecord, progress: number, date: number): FloorStatus {
  if (progress <= 0) return "planned"
  if (progress >= 100) return "ready"
  if (record.problemSince && date >= parseDate(record.problemSince)) return "problem"
  return "building"
}

/** Снимок здания на дату — чистая функция, удобна для таймлайна и тестов. */
export function getFloorsAt(date: number): FloorSnapshot[] {
  return floorsDb.map((record) => {
    const progress = progressAt(record, date)
    const status = statusAt(record, progress, date)
    return {
      floorIndex: record.floorIndex,
      label: record.label,
      status,
      progress,
      rooms: buildRooms(record, progress, status),
    }
  })
}

export interface BuildingSummary {
  totalProgress: number
  totalArea: number
  counts: Record<FloorStatus, number>
}

export function getBuildingSummary(floors: FloorSnapshot[]): BuildingSummary {
  const counts: Record<FloorStatus, number> = { ready: 0, building: 0, problem: 0, planned: 0 }
  let weighted = 0
  let totalArea = 0
  for (const floor of floors) {
    const area = floorsDb[floor.floorIndex].area
    counts[floor.status]++
    weighted += floor.progress * area
    totalArea += area
  }
  return { totalProgress: Math.round(weighted / totalArea), totalArea, counts }
}

export const DAY_MS = DAY

/** Имитация запроса к API. Поддерживает отмену через AbortSignal. */
export function fetchFloorDetails(floorIndex: number, signal?: AbortSignal): Promise<FloorDetails> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const record = floorsDb[floorIndex]
      if (!record) {
        reject(new Error(`Этаж ${floorIndex} не найден`))
        return
      }
      const { area, contractor, workers, deadline, note } = record
      resolve({ floorIndex, area, contractor, workers, deadline, note })
    }, 500)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    })
  })
}
