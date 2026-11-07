import { useEffect, useState } from "react"
import { fetchFloorDetails, type FloorDetails } from "../floorService"

interface FloorDetailsState {
  data: FloorDetails | null
  loading: boolean
  error: string | null
}

/**
 * Загружает подробности этажа с кэшем и отменой устаревших запросов:
 * при быстром переключении этажей панель не покажет данные «не того» этажа.
 */
export function useFloorDetails(floorIndex: number | null): FloorDetailsState {
  const [cache, setCache] = useState<ReadonlyMap<number, FloorDetails>>(() => new Map())
  const [errors, setErrors] = useState<ReadonlyMap<number, string>>(() => new Map())

  useEffect(() => {
    if (floorIndex === null || cache.has(floorIndex)) return
    const controller = new AbortController()
    fetchFloorDetails(floorIndex, controller.signal)
      .then((details) => setCache((prev) => new Map(prev).set(floorIndex, details)))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : "Не удалось загрузить данные"
        setErrors((prev) => new Map(prev).set(floorIndex, message))
      })
    return () => controller.abort()
  }, [floorIndex, cache])

  if (floorIndex === null) return { data: null, loading: false, error: null }
  const data = cache.get(floorIndex) ?? null
  const error = errors.get(floorIndex) ?? null
  return { data, loading: !data && !error, error }
}
