export type FloorStatus = "ready" | "building" | "problem"

/** Краткие данные этажа — доступны сразу, нужны для 3D-сцены и списка этажей. */
export interface FloorSummary {
  floorIndex: number
  label: string
  status: FloorStatus
  progress: number
}

/** Подробные данные этажа — «загружаются» с сервера по запросу. */
export interface FloorDetails extends FloorSummary {
  area: number
  contractor: string
  workers: number
  deadline: string
  note?: string
}

const floorsDb: FloorDetails[] = [
  { floorIndex: 0, label: "1-й этаж", status: "ready",    progress: 100, area: 520, contractor: "СтройГрупп",  workers: 0,  deadline: "2026-03-15" },
  { floorIndex: 1, label: "2-й этаж", status: "ready",    progress: 100, area: 480, contractor: "СтройГрупп",  workers: 0,  deadline: "2026-04-20" },
  { floorIndex: 2, label: "3-й этаж", status: "ready",    progress: 100, area: 480, contractor: "СтройГрупп",  workers: 2,  deadline: "2026-05-30" },
  { floorIndex: 3, label: "4-й этаж", status: "building", progress: 85,  area: 480, contractor: "МегаСтрой",   workers: 14, deadline: "2026-12-01" },
  { floorIndex: 4, label: "5-й этаж", status: "problem",  progress: 40,  area: 480, contractor: "МегаСтрой",   workers: 6,  deadline: "2026-10-15", note: "Задержка поставки арматуры, срок сорван на 3 недели" },
  { floorIndex: 5, label: "6-й этаж", status: "building", progress: 55,  area: 460, contractor: "АльфаСтрой",  workers: 18, deadline: "2027-01-20" },
  { floorIndex: 6, label: "7-й этаж", status: "building", progress: 25,  area: 460, contractor: "АльфаСтрой",  workers: 11, deadline: "2027-03-10" },
  { floorIndex: 7, label: "8-й этаж", status: "problem",  progress: 10,  area: 440, contractor: "АльфаСтрой",  workers: 3,  deadline: "2027-04-25", note: "Замечания стройнадзора по опалубке" },
]

export const FLOORS: FloorSummary[] = floorsDb.map(({ floorIndex, label, status, progress }) => ({
  floorIndex,
  label,
  status,
  progress,
}))

export const FLOOR_STATUSES: FloorStatus[] = ["ready", "building", "problem"]

export const STATUS_COLORS: Record<FloorStatus, string> = {
  ready:    "#22c55e",
  building: "#f59e0b",
  problem:  "#ef4444",
}

export const STATUS_LABELS: Record<FloorStatus, string> = {
  ready:    "Готов",
  building: "Строится",
  problem:  "Проблема",
}

export const PROJECT_NAME = "ЖК «Северный квартал»"

export interface BuildingSummary {
  totalProgress: number
  totalArea: number
  counts: Record<FloorStatus, number>
}

export function getBuildingSummary(): BuildingSummary {
  const counts: Record<FloorStatus, number> = { ready: 0, building: 0, problem: 0 }
  let weighted = 0
  let totalArea = 0
  for (const floor of floorsDb) {
    counts[floor.status]++
    weighted += floor.progress * floor.area
    totalArea += floor.area
  }
  return { totalProgress: Math.round(weighted / totalArea), totalArea, counts }
}

/** Имитация запроса к API. Поддерживает отмену через AbortSignal. */
export function fetchFloorDetails(floorIndex: number, signal?: AbortSignal): Promise<FloorDetails> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const floor = floorsDb[floorIndex]
      if (floor) resolve(floor)
      else reject(new Error(`Этаж ${floorIndex} не найден`))
    }, 500)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    })
  })
}
