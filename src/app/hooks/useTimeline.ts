import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DAY_MS, PROJECT_START, TODAY, getFloorsAt, type FloorSnapshot } from "../../features/building-info/floorService"

/** Скорость проигрывания: дней стройки в секунду. */
const DAYS_PER_SECOND = 40
const KEY_STEP_DAYS = 30

export interface TimelineState {
  date: number
  floors: FloorSnapshot[]
  playing: boolean
  isLive: boolean
  seek: (date: number) => void
  togglePlay: () => void
  goLive: () => void
}

function clampDate(date: number) {
  return Math.min(TODAY, Math.max(PROJECT_START, date))
}

/** Машина времени по истории стройки: текущая дата, проигрывание, снимок здания. */
export function useTimeline(): TimelineState {
  const [date, setDate] = useState(TODAY)
  const [playing, setPlaying] = useState(false)
  const dateRef = useRef(TODAY)

  const seek = useCallback((next: number) => {
    const clamped = clampDate(next)
    dateRef.current = clamped
    setDate(clamped)
  }, [])

  const togglePlay = useCallback(() => {
    setPlaying((wasPlaying) => {
      if (!wasPlaying && dateRef.current >= TODAY) {
        dateRef.current = PROJECT_START
        setDate(PROJECT_START)
      }
      return !wasPlaying
    })
  }, [])

  const goLive = useCallback(() => {
    setPlaying(false)
    seek(TODAY)
  }, [seek])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const next = clampDate(dateRef.current + ((now - last) / 1000) * DAYS_PER_SECOND * DAY_MS)
      last = now
      dateRef.current = next
      setDate(next)
      if (next >= TODAY) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  // ←/→ — месяц назад/вперёд
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      setPlaying(false)
      seek(dateRef.current + (event.key === "ArrowRight" ? 1 : -1) * KEY_STEP_DAYS * DAY_MS)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [seek])

  // Снимок пересчитываем не чаще раза в сутки «стройки»
  const day = Math.floor(date / DAY_MS)
  const floors = useMemo(() => getFloorsAt(day * DAY_MS), [day])

  return { date, floors, playing, isLive: date >= TODAY, seek, togglePlay, goLive }
}
