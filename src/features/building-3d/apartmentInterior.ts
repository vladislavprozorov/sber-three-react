import * as THREE from "three"
import type { RoomSnapshot } from "../building-info/floorService"
import {
  CEILING,
  getApartmentLayout,
  getBuildState,
  type ApartmentLayout,
  type ApartmentRoom,
  type WallGap,
  type WallSegment,
} from "../apartment/apartmentLayout"
import * as F from "./apartmentFurniture"
import { Kit, createMaterials, tiled, type Materials } from "./interiorKit"

/**
 * Процедурный интерьер квартиры. Строится в метрах (y — вверх от пола),
 * масштаб в единицы сцены задаёт вызывающий код.
 */

export interface ApartmentInterior {
  group: THREE.Group
  /** Подписи комнат — сцена приглушает их при приближении к комнате */
  labels: THREE.Sprite[]
}

// ───────────────────────── Расстановка у стен ─────────────────────────

type Side = "x0" | "x1" | "z0" | "z1"

/** Отступ предметов от оси стены (полтолщины стены + зазор). */
const INSET = 0.14
/** Свободное место в углу, чтобы предметы на соседних стенах не пересекались. */
const CORNER = 0.7

interface Slot {
  x: number
  z: number
  rot: number
  length: number
  /** Свободный отрезок стены, на котором стоит предмет (вдоль стены) */
  span: [number, number]
  along: number
  side: Side
}

function sideFixed(r: ApartmentRoom, side: Side) {
  return { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }[side]
}

function sideRange(r: ApartmentRoom, side: Side): [number, number] {
  return side === "x0" || side === "x1" ? [r.z0 + INSET, r.z1 - INSET] : [r.x0 + INSET, r.x1 - INSET]
}

/** Проёмы (двери, при необходимости и окна) на стороне комнаты. */
function openings(layout: ApartmentLayout, r: ApartmentRoom, side: Side, withWindows: boolean): [number, number][] {
  const axis = side === "x0" || side === "x1" ? "z" : "x"
  const fixed = sideFixed(r, side)
  return layout.walls
    .filter((w) => w.axis === axis && Math.abs(w.fixed - fixed) < 0.01)
    .flatMap((w) => w.gaps)
    .filter((g) => g.kind === "door" || withWindows)
    .map((g): [number, number] => [g.at - g.width / 2 - 0.15, g.at + g.width / 2 + 0.15])
}

function freeSpans(layout: ApartmentLayout, r: ApartmentRoom, side: Side, tall: boolean, corners: boolean) {
  const [from, to] = sideRange(r, side)
  let spans: [number, number][] = [[corners ? from : from + CORNER, corners ? to : to - CORNER]]
  for (const [a, b] of openings(layout, r, side, tall)) {
    spans = spans.flatMap(([s, e]): [number, number][] => {
      if (b <= s || a >= e) return [[s, e]]
      const out: [number, number][] = []
      if (a > s) out.push([s, a])
      if (b < e) out.push([b, e])
      return out
    })
  }
  return spans.filter(([s, e]) => e - s > 0.2).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))
}

/** Точка у стены на расстоянии depth/2 от неё, предмет «спиной» к стене. */
function toSlot(r: ApartmentRoom, side: Side, along: number, depth: number) {
  const off = INSET + depth / 2
  switch (side) {
    case "x0": return { x: r.x0 + off, z: along, rot: Math.PI / 2 }
    case "x1": return { x: r.x1 - off, z: along, rot: -Math.PI / 2 }
    case "z0": return { x: along, z: r.z0 + off, rot: 0 }
    case "z1": return { x: along, z: r.z1 - off, rot: Math.PI }
  }
}

interface SlotOptions {
  sides: Side[]
  minLength: number
  maxLength: number
  depth: number
  tall?: boolean
  corners?: boolean
  align?: "start" | "center" | "end"
}

interface Placement {
  x: number
  z: number
  rot: number
}

interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

/** Прямоугольник, который предмет занимает на полу. length — вдоль локальной оси x, depth — вдоль z. */
function footprint(at: Placement, length: number, depth: number): Rect {
  const across = Math.abs(Math.sin(at.rot)) > 0.5
  const hx = (across ? depth : length) / 2
  const hz = (across ? length : depth) / 2
  return { x0: at.x - hx, x1: at.x + hx, z0: at.z - hz, z1: at.z + hz }
}

function overlaps(a: Rect, b: Rect, margin = 0.04) {
  return a.x0 < b.x1 - margin && a.x1 > b.x0 + margin && a.z0 < b.z1 - margin && a.z1 > b.z0 + margin
}

/**
 * Расставляет мебель в комнате: ищет свободные участки стен (без дверей и, для высоких предметов, окон)
 * и следит, чтобы предметы не пересекались.
 */
class RoomPlanner {
  private readonly used = new Set<Side>()
  private readonly occupied: Rect[] = []
  private readonly layout: ApartmentLayout
  private readonly room: ApartmentRoom

  constructor(layout: ApartmentLayout, room: ApartmentRoom) {
    this.layout = layout
    this.room = room
  }

  private isFree(rect: Rect) {
    const r = this.room
    const inside = rect.x0 >= r.x0 + 0.05 && rect.x1 <= r.x1 - 0.05 && rect.z0 >= r.z0 + 0.05 && rect.z1 <= r.z1 - 0.05
    return inside && this.occupied.every((o) => !overlaps(o, rect))
  }

  /** Занять место, если оно свободно. */
  place(at: Placement, length: number, depth: number) {
    const rect = footprint(at, length, depth)
    if (!this.isFree(rect)) return false
    this.occupied.push(rect)
    return true
  }

  /** Найти свободную стену под крупный предмет; одна стена — один крупный предмет. */
  slot({ sides, minLength, maxLength, depth, tall = false, corners = false, align = "center" }: SlotOptions): Slot | null {
    const r = this.room
    const perpendicular = (side: Side) => (side === "x0" || side === "x1" ? r.x1 - r.x0 : r.z1 - r.z0)
    const aligns = [...new Set([align, "start", "center", "end"] as const)]
    for (const side of sides) {
      if (this.used.has(side) || perpendicular(side) < depth + 0.5) continue
      for (const span of freeSpans(this.layout, r, side, tall, corners)) {
        if (span[1] - span[0] < minLength) continue
        const length = Math.min(maxLength, span[1] - span[0])
        for (const a of aligns) {
          const along = a === "start" ? span[0] + length / 2 : a === "end" ? span[1] - length / 2 : (span[0] + span[1]) / 2
          const at = toSlot(r, side, along, depth)
          if (!this.place(at, length, depth)) continue
          this.used.add(side)
          return { ...at, length, span, along, side }
        }
      }
    }
    return null
  }

  /** Предмет на той же стене со сдвигом вдоль неё (тумбочка, торшер, стиральная машина). */
  beside(slot: Slot, offset: number, length: number, depth: number): Placement | null {
    const along = slot.along + offset
    if (along - length / 2 < slot.span[0] - 0.01 || along + length / 2 > slot.span[1] + 0.01) return null
    const at = toSlot(this.room, slot.side, along, depth)
    return this.place(at, length, depth) ? at : null
  }

  /** Сместиться от стены вглубь комнаты (отрицательное значение — к стене). */
  inward(at: Placement, side: Side, distance: number): Placement {
    const [dx, dz] = { x0: [1, 0], x1: [-1, 0], z0: [0, 1], z1: [0, -1] }[side]
    return { x: at.x + dx * distance, z: at.z + dz * distance, rot: at.rot }
  }

  /** Точка вдоль той же стены (без проверки места). */
  along(slot: Slot, along: number, depth: number): Placement {
    return toSlot(this.room, slot.side, along, depth)
  }
}

function put(parent: Kit, at: Placement, y = 0) {
  return parent.child(at.x, y, at.z, at.rot)
}

// ───────────────────────── Комнаты ─────────────────────────

function center(r: ApartmentRoom) {
  return { cx: (r.x0 + r.x1) / 2, cz: (r.z0 + r.z1) / 2, rw: r.x1 - r.x0, rd: r.z1 - r.z0 }
}

const ALL_SIDES: Side[] = ["x0", "x1", "z1", "z0"]

function furnishRoom(k: Kit, layout: ApartmentLayout, r: ApartmentRoom, m: Materials, index: number) {
  const plan = new RoomPlanner(layout, r)
  const { cx, cz, rw, rd } = center(r)
  const plantAt = (x: number, z: number, size = 1) => {
    const at = { x, z, rot: 0 }
    if (plan.place(at, 0.45 * size, 0.45 * size)) F.plant(put(k, at), m, size)
  }

  switch (r.kind) {
    case "kitchen":
    case "kitchen-living": {
      const target = r.kind === "kitchen" ? 3 : 2.4
      const run = plan.slot({ sides: ["x0", "x1", "z1"], minLength: 1.8, maxLength: target + 0.75, depth: 0.62, corners: true, align: "start" })
      if (run) {
        const len = Math.min(target, run.length - 0.75)
        const start = run.along - run.length / 2
        const runAt = plan.along(run, start + len / 2, 0.6)
        F.kitchenRun(put(k, runAt), m, len)
        if (run.length - len >= 0.7) F.fridge(put(k, plan.along(run, start + len + 0.36, 0.64)), m)

        // обеденный стол параллельно гарнитуру: в узкой кухне стулья по торцам
        const width = run.side === "x0" || run.side === "x1" ? rw : rd
        const wide = width >= 2.6
        const table = plan.inward(runAt, run.side, wide ? 1.12 : 0.85)
        if (plan.place(table, wide ? 1.3 : 2.4, wide ? 1.55 : 0.85)) F.diningSet(put(k, table), m, wide ? "four" : "ends")
      }
      if (r.kind === "kitchen-living") {
        const sofa = plan.slot({ sides: ["x1", "z1"], minLength: 1.8, maxLength: 2.0, depth: 0.92, align: "end" })
        if (sofa) {
          F.sofa(put(k, sofa), m, sofa.length)
          const table = plan.inward(sofa, sofa.side, 1.0)
          if (plan.place(table, 1.0, 0.55)) {
            F.rug(put(k, table), m.rug, 1.9, 1.3)
            F.coffeeTable(put(k, table), m)
          }
        }
        plantAt(r.x1 - 0.4, r.z0 + 0.4)
      }
      break
    }
    case "living": {
      F.rug(k.child(cx, 0, cz), m.rug, Math.min(2.4, rw - 1.2), Math.min(2.2, rd - 1.6))
      const sofa = plan.slot({ sides: ["x0", "x1", "z1"], minLength: 1.8, maxLength: 2.3, depth: 0.92 })
      if (sofa) {
        F.sofa(put(k, sofa), m, sofa.length)
        const table = plan.inward(sofa, sofa.side, 1.05)
        if (plan.place(table, 1.0, 0.55)) F.coffeeTable(put(k, table), m)
        F.painting(put(k, plan.inward(sofa, sofa.side, -0.44), 1.35), m, index, 0.9, 0.6)
        const lamp = plan.beside(sofa, sofa.length / 2 + 0.3, 0.3, 0.3)
        if (lamp) F.floorLamp(put(k, lamp), m)
      }
      const tv = plan.slot({ sides: ["x1", "x0", "z1"], minLength: 1.4, maxLength: 1.7, depth: 0.42 })
      if (tv) F.tvUnit(put(k, tv), m, tv.length)
      const shelf = plan.slot({ sides: ["z1", "x1", "x0"], minLength: 0.9, maxLength: 1.3, depth: 0.32, tall: true })
      if (shelf) F.bookshelf(put(k, shelf), m, shelf.length)
      plantAt(r.x1 - 0.4, r.z0 + 0.4, 1.2)
      break
    }
    case "bedroom": {
      const kids = r.name === "Детская"
      const width = kids ? 0.95 : 1.6
      const bed = plan.slot({ sides: ["z1", "x1", "x0", "z0"], minLength: width + 0.05, maxLength: width + 0.05, depth: 2.05, corners: true })
      if (bed) {
        F.bed(put(k, bed), m, width, kids ? m.kidsDuvet : m.duvet)
        if (bed.side !== "z0") F.painting(put(k, plan.inward(bed, bed.side, -0.98), 1.35), m, index + 1, 0.8, 0.55)
        for (const dir of kids ? [1, -1] : [-1, 1]) {
          const stand = plan.beside(bed, dir * (width / 2 + 0.3), 0.45, 0.4)
          if (stand) {
            F.nightstand(put(k, stand), m)
            if (kids) break
          }
        }
        F.rug(put(k, plan.inward(bed, bed.side, 1.3)), kids ? m.kidsRug : m.rug, width + 0.6, 0.9)
      }
      const closet = plan.slot({ sides: ["x0", "x1", "z1"], minLength: 1.0, maxLength: 1.6, depth: 0.6, tall: true, corners: true, align: "start" })
      if (closet) F.wardrobe(put(k, closet), m, closet.length)
      if (kids) {
        const desk = plan.slot({ sides: ["z0", "x1", "x0"], minLength: 1.1, maxLength: 1.2, depth: 1.1, corners: true })
        if (desk) F.desk(put(k, plan.inward(desk, desk.side, -0.25)), m, desk.length)
        const box = { x: cx, z: cz + 0.3, rot: 0.3 }
        if (plan.place(box, 1.0, 0.8)) F.toys(put(k, box), m)
      } else {
        plantAt(r.x0 + 0.4, r.z0 + 0.4, 0.9)
      }
      break
    }
    case "bath": {
      const tub = plan.slot({ sides: ["x0", "x1", "z0", "z1"], minLength: 1.7, maxLength: 1.7, depth: 0.75, corners: true, align: "start" })
      if (tub) F.bathtub(put(k, tub), m)
      const sink = plan.slot({ sides: ["z0", "z1", "x0", "x1"], minLength: 0.62, maxLength: 0.62, depth: 0.47, corners: true, align: "start" })
      if (sink) {
        F.vanity(put(k, sink), m)
        for (const dir of [1, -1]) {
          const wash = plan.beside(sink, dir * 0.66, 0.6, 0.58)
          if (wash) {
            F.washer(put(k, wash), m)
            break
          }
        }
      }
      const wc = plan.slot({ sides: ["z1", "z0", "x1", "x0"], minLength: 0.5, maxLength: 0.45, depth: 0.7, corners: true })
      if (wc) F.toilet(put(k, wc), m)
      const rail = plan.slot({ sides: ALL_SIDES, minLength: 0.5, maxLength: 0.5, depth: 0.08, tall: true, corners: true })
      if (rail) F.towelRail(put(k, rail), m)
      break
    }
    case "hall": {
      const rack = plan.slot({ sides: ["x0", "x1", "z0"], minLength: 0.8, maxLength: 1.2, depth: 0.35, tall: true, corners: true })
      if (rack) F.coatRack(put(k, rack), m, rack.length)
      const bench = plan.slot({ sides: ["x1", "x0", "z0"], minLength: 0.9, maxLength: 0.9, depth: 0.32, corners: true })
      if (bench) {
        F.shoeBench(put(k, bench), m, bench.length)
        F.wallMirror(put(k, plan.inward(bench, bench.side, -0.14)), m)
      }
      // коврик у входной двери
      F.rug(k.child(cx, 0, r.z1 - 0.5), m.rug, 0.9, 0.6)
      break
    }
  }
}

/** Плитка на стенах санузла — по тем же проёмам, что и стены. */
function cladBathroom(k: Kit, layout: ApartmentLayout, r: ApartmentRoom, m: Materials) {
  const height = 2.1
  for (const side of ALL_SIDES) {
    const [from, to] = sideRange(r, side)
    let spans: [number, number][] = [[from - INSET + 0.07, to + INSET - 0.07]]
    for (const [a, b] of openings(layout, r, side, false)) {
      spans = spans.flatMap(([s, e]): [number, number][] =>
        b <= s || a >= e ? [[s, e]] : ([[s, a + 0.15], [b - 0.15, e]] as [number, number][]).filter(([p, q]) => q - p > 0.05),
      )
    }
    for (const [s, e] of spans) {
      const len = e - s
      const at = toSlot(r, side, (s + e) / 2, 0.01)
      const panel = put(k, { ...at, ...(side.startsWith("x") ? { x: at.x - (side === "x0" ? 0.07 : -0.07) } : { z: at.z - (side === "z0" ? 0.07 : -0.07) }) })
      panel.box(tiled(m.wallTileMap, len, height, 0.9, 0.25), len, height, 0.01, 0, 0.06, 0)
    }
  }
}

// ───────────────────────── Стены, окна, двери ─────────────────────────

function addWall(k: Kit, wall: WallSegment, height: number, m: Materials, state: ReturnType<typeof getBuildState>) {
  const thickness = wall.outer ? 0.25 : 0.12
  const material = wall.outer ? m.outerWall : m.wall

  const piece = (a: number, b: number, y0: number, y1: number, mat: THREE.Material = material, t = thickness, offset = 0) => {
    const top = Math.min(y1, height)
    if (b - a < 0.01 || top - y0 < 0.01) return
    const mid = (a + b) / 2
    if (wall.axis === "x") k.box(mat, b - a, top - y0, t, mid, y0, wall.fixed + offset)
    else k.box(mat, t, top - y0, b - a, wall.fixed + offset, y0, mid)
  }

  let cursor = wall.from
  for (const gap of [...wall.gaps].sort((a, b) => a.at - b.at)) {
    const start = gap.at - gap.width / 2
    const end = gap.at + gap.width / 2
    piece(cursor, start, 0, height)
    if (gap.kind === "door") {
      piece(start, end, 2.1, CEILING)
      if (height >= 2.1) addDoor(k, wall, gap, m, state)
    } else {
      piece(start, end, 0, 0.85)
      piece(start, end, 2.25, CEILING)
      if (state.windows && height >= 2.25) addWindow(piece, start, end, m, thickness)
    }
    cursor = end
  }
  piece(cursor, wall.to, 0, height)
}

type Piece = (a: number, b: number, y0: number, y1: number, mat?: THREE.Material, t?: number, offset?: number) => void

/** Окно: стеклопакет, рама с импостом, подоконник изнутри. */
function addWindow(piece: Piece, start: number, end: number, m: Materials, thickness: number) {
  const mid = (start + end) / 2
  piece(start, end, 0.9, 2.2, m.glass, 0.03)
  piece(start, end, 0.85, 0.91, m.frame, 0.09)
  piece(start, end, 2.19, 2.25, m.frame, 0.09)
  piece(start, start + 0.06, 0.85, 2.25, m.frame, 0.09)
  piece(end - 0.06, end, 0.85, 2.25, m.frame, 0.09)
  piece(mid - 0.03, mid + 0.03, 0.85, 2.25, m.frame, 0.09)
  // подоконник выступает в комнату (фасад — со стороны -z)
  piece(start - 0.05, end + 0.05, 0.85, 0.89, m.frame, 0.3, thickness / 2)
}

/** Дверное полотно: входная — закрыта, межкомнатные — приоткрыты. */
function addDoor(k: Kit, wall: WallSegment, gap: WallGap, m: Materials, state: ReturnType<typeof getBuildState>) {
  const entrance = wall.outer
  if (entrance ? !state.windows : !state.floorFinish) return
  const w = gap.width - 0.04
  const hingeAlong = gap.at - gap.width / 2 + 0.02
  const hinge = wall.axis === "x" ? k.child(hingeAlong, 0, wall.fixed) : k.child(wall.fixed, 0, hingeAlong)
  const open = entrance ? 0 : THREE.MathUtils.degToRad(70)
  hinge.group.rotation.y = wall.axis === "x" ? -open : -Math.PI / 2 + open
  const leaf = entrance ? m.entranceDoor : m.door
  hinge.box(leaf, w, 2.05, 0.045, w / 2, 0.05, 0)
  hinge.box(m.chrome, 0.12, 0.025, 0.03, w - 0.12, 1.0, 0.04)
  hinge.box(m.chrome, 0.12, 0.025, 0.03, w - 0.12, 1.0, -0.04)
  if (entrance) hinge.cyl(m.dark, 0.012, 0.012, 0.01, w / 2, 1.55, 0.03, 8) // глазок
}

/** Шторы и карниз на окнах жилых комнат. */
function addCurtains(k: Kit, layout: ApartmentLayout, r: ApartmentRoom, m: Materials) {
  const facade = layout.walls.find((w) => w.axis === "x" && w.outer && Math.abs(w.fixed - r.z0) < 0.01)
  if (!facade) return
  for (const gap of facade.gaps) {
    if (gap.kind !== "window" || gap.at < r.x0 || gap.at > r.x1) continue
    const z = r.z0 + 0.22
    k.box(m.chrome, gap.width + 0.7, 0.025, 0.025, gap.at, 2.4, z)
    for (const side of [-1, 1]) {
      const curtain = k.box(m.curtain, 0.32, 2.3, 0.06, gap.at + side * (gap.width / 2 + 0.15), 0.08, z)
      curtain.scale.z = 1.4
    }
  }
}

function addMarkup(k: Kit, wall: WallSegment, m: Materials) {
  const len = wall.to - wall.from
  const mid = (wall.from + wall.to) / 2
  if (wall.axis === "x") k.box(m.markup, len, 0.02, 0.06, mid, 0.06, wall.fixed)
  else k.box(m.markup, 0.06, 0.02, len, wall.fixed, 0.06, mid)
}

// ───────────────────────── Стройка ─────────────────────────

function addConstructionProps(k: Kit, rooms: ApartmentRoom[], m: Materials, problem: boolean) {
  const big = [...rooms].sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0]
  const { cx, cz } = center(big)
  F.bricksPallet(k.child(cx - 0.5, 0, cz - 0.3, 0.2), m)
  F.cementBags(k.child(cx + 0.65, 0, cz - 0.6), m)
  F.sawhorse(k.child(cx + 0.3, 0, cz + 1.0, 0.1), m)
  if (problem) {
    for (const [dx, dz] of [[-1.3, -1.1], [-1.3, 0.9], [0.9, 0.2]]) F.trafficCone(k.child(cx + dx, 0, cz + dz), m)
  }
}

// ───────────────────────── Подписи ─────────────────────────

function roomLabel(room: ApartmentRoom) {
  const canvas = document.createElement("canvas")
  canvas.width = 320
  canvas.height = 112
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "rgba(15, 18, 25, 0.82)"
  ctx.beginPath()
  ctx.roundRect(4, 4, 312, 104, 26)
  ctx.fill()
  ctx.textAlign = "center"
  ctx.fillStyle = "#ffffff"
  ctx.font = "600 40px Inter, system-ui, sans-serif"
  ctx.fillText(room.name, 160, 52)
  ctx.fillStyle = "#94a3b8"
  ctx.font = "500 32px Inter, system-ui, sans-serif"
  ctx.fillText(`${room.area} м²`, 160, 92)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }),
  )
  sprite.renderOrder = 10
  const { cx, cz } = center(room)
  sprite.position.set(cx, CEILING + 0.6, cz)
  sprite.scale.set(2.0, 0.7, 1)
  return sprite
}

// ───────────────────────── Сборка ─────────────────────────

/** Ключ перестройки: интерьер пересоздаётся, только когда меняется что-то видимое. */
export function interiorKey(apartment: RoomSnapshot) {
  const s = getBuildState(apartment.progress)
  return [apartment.number, apartment.status, Math.round(s.wallHeight * 20), s.windows, s.plaster, s.floorFinish, s.furniture].join("|")
}

export function buildApartmentInterior(apartment: RoomSnapshot): ApartmentInterior {
  const layout = getApartmentLayout(apartment)
  const state = getBuildState(apartment.progress)
  const m = createMaterials(state.plaster)
  const root = new Kit()
  const labels: THREE.Sprite[] = []

  // Плита перекрытия под всей квартирой
  root.box(m.concrete, layout.width + 0.1, 0.03, layout.depth + 0.1, 0, -0.01, 0)

  layout.rooms.forEach((room, index) => {
    const { cx, cz, rw, rd } = center(room)
    // каждая комната — своя группа: по userData.area сцена понимает, на какую комнату навели
    const kit = root.child()
    kit.group.userData.area = index

    let floor: THREE.Material = m.concrete
    if (state.floorFinish) {
      if (room.kind === "bath") floor = tiled(m.floorTileMap, rw, rd, 1.0, 0.35)
      else if (room.kind === "kitchen" || room.kind === "hall") floor = tiled(m.kitchenTileMap, rw, rd, 1.5, 0.45)
      else floor = tiled(m.woodMap, rw, rd, 1.6, 0.55)
    }
    kit.box(floor, rw, 0.04, rd, cx, 0.02, cz)

    if (state.plaster && room.kind === "bath") cladBathroom(kit, layout, room, m)
    if (state.furniture) {
      furnishRoom(kit, layout, room, m, index)
      if (room.kind !== "kitchen" && room.kind !== "bath" && room.kind !== "hall") addCurtains(kit, layout, room, m)
    }

    const label = roomLabel(room)
    kit.group.add(label)
    labels.push(label)
  })

  const height = state.wallHeight * CEILING
  for (const wall of layout.walls) {
    if (height <= 0) addMarkup(root, wall, m)
    else addWall(root, wall, height, m, state)
  }

  if (apartment.progress > 0 && !state.furniture) {
    addConstructionProps(root, layout.rooms, m, apartment.status === "problem")
  }

  return { group: root.group, labels }
}

/** Освободить GPU-ресурсы интерьера. */
export function disposeObject(root: THREE.Object3D) {
  const disposed = new Set<unknown>()
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry && !(obj instanceof THREE.Sprite) && !disposed.has(mesh.geometry)) {
      disposed.add(mesh.geometry)
      mesh.geometry.dispose()
    }
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
    for (const material of materials) {
      if (disposed.has(material)) continue
      disposed.add(material)
      const map = (material as THREE.MeshStandardMaterial).map
      if (map) map.dispose()
      material.dispose()
    }
  })
  root.removeFromParent()
}
