export type FloorStatus = "ready" | "building" | "problem"

export interface FloorData {
  floorIndex: number
  label: string
  status: FloorStatus
  progress: number
  area: number
  contractor: string
}

const mockFloors: FloorData[] = [
  { floorIndex: 0, label: "1-й этаж",  status: "ready",    progress: 100, area: 450, contractor: "СтройГрупп" },
  { floorIndex: 1, label: "2-й этаж",  status: "ready",    progress: 100, area: 430, contractor: "СтройГрупп" },
  { floorIndex: 2, label: "3-й этаж",  status: "building", progress: 65,  area: 430, contractor: "МегаСтрой" },
  { floorIndex: 3, label: "4-й этаж",  status: "problem",  progress: 30,  area: 430, contractor: "МегаСтрой" },
  { floorIndex: 4, label: "5-й этаж",  status: "building", progress: 10,  area: 410, contractor: "АльфаБuild" },
]

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

export function fetchFloorData(floorIndex: number): Promise<FloorData> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockFloors[floorIndex])
    }, 600)
  })
}

export { mockFloors }
