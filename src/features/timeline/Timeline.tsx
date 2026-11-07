import type { CSSProperties } from "react"
import { DAY_MS, PROJECT_START, TODAY } from "../building-info/floorService"

type Props = {
  date: number
  playing: boolean
  isLive: boolean
  progress: number
  onSeek: (date: number) => void
  onTogglePlay: () => void
  onGoLive: () => void
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" })
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "short" })

/** Отметки начала кварталов на шкале. */
const TICKS = (() => {
  const ticks: { pos: number; label: string }[] = []
  const d = new Date(PROJECT_START)
  d.setDate(1)
  while (d.getTime() <= TODAY) {
    if (d.getTime() >= PROJECT_START && d.getMonth() % 3 === 0) {
      const label = d.getMonth() === 0 ? String(d.getFullYear()) : monthFormat.format(d).replace(".", "")
      ticks.push({ pos: (d.getTime() - PROJECT_START) / (TODAY - PROJECT_START), label })
    }
    d.setMonth(d.getMonth() + 1)
  }
  return ticks
})()

export default function Timeline({ date, playing, isLive, progress, onSeek, onTogglePlay, onGoLive }: Props) {
  const fraction = (date - PROJECT_START) / (TODAY - PROJECT_START)

  return (
    <div className="timeline glass">
      <button
        type="button"
        className="timeline-play"
        onClick={onTogglePlay}
        aria-label={playing ? "Пауза" : "Проиграть историю стройки"}
        title={playing ? "Пауза" : "Проиграть историю стройки"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M7 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 7 5.5Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="timeline-track">
        <div className="timeline-meta">
          <span className="timeline-date">{dateFormat.format(date)}</span>
          <span className="muted">готовность {progress}%</span>
        </div>
        <div className="timeline-range" style={{ "--fill": `${fraction * 100}%` } as CSSProperties}>
          <input
            type="range"
            min={PROJECT_START}
            max={TODAY}
            step={DAY_MS}
            value={date}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Дата на шкале строительства"
            aria-valuetext={dateFormat.format(date)}
          />
          <div className="timeline-ticks" aria-hidden="true">
            {TICKS.map((tick) => (
              <span key={tick.pos} style={{ left: `${tick.pos * 100}%` }}>
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button type="button" className="timeline-live" data-live={isLive} onClick={onGoLive} disabled={isLive}>
        <span className="live-dot" />
        Сегодня
      </button>
    </div>
  )
}
