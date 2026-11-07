import * as THREE from "three"
import type { Kit, Materials } from "./interiorKit"

/**
 * Детализированная мебель. Каждый предмет строится в своей группе:
 * центр — середина «пятна» на полу, спинка/задняя стенка смотрит в -z, лицевая сторона — в +z.
 */

const FLOOR = 0.06

// ───────────────────────── Кухня ─────────────────────────

/** Кухонный гарнитур: нижние шкафы, духовка, варочная панель, мойка, фартук, верхние шкафы и вытяжка. */
export function kitchenRun(k: Kit, m: Materials, length: number) {
  const depth = 0.6
  const modules = Math.max(2, Math.round(length / 0.6))
  const mw = length / modules
  const back = -depth / 2
  const ovenIndex = Math.min(1, modules - 1)
  const sinkIndex = modules - 1

  k.box(m.dark, length, 0.1, depth - 0.06, 0, FLOOR, -0.03) // цоколь
  k.box(m.cabinet, length, 0.76, depth - 0.02, 0, FLOOR + 0.1, -0.01)

  for (let i = 0; i < modules; i++) {
    const x = -length / 2 + mw * (i + 0.5)
    if (i === ovenIndex) {
      // духовой шкаф с тёмным стеклом и ручкой
      k.box(m.black, mw - 0.03, 0.56, 0.02, x, FLOOR + 0.2, depth / 2)
      k.box(m.chrome, mw - 0.16, 0.025, 0.03, x, FLOOR + 0.72, depth / 2 + 0.03)
      k.box(m.dark, mw - 0.03, 0.1, 0.02, x, FLOOR + 0.12, depth / 2)
    } else {
      k.box(m.cabinetFront, mw - 0.03, 0.7, 0.02, x, FLOOR + 0.13, depth / 2)
      k.box(m.chrome, 0.28, 0.02, 0.025, x, FLOOR + 0.76, depth / 2 + 0.025)
    }
  }

  // столешница
  k.box(m.stone, length + 0.02, 0.04, depth + 0.03, 0, FLOOR + 0.86, 0)
  const top = FLOOR + 0.9

  // варочная панель над духовкой: стекло и 4 конфорки
  const hobX = -length / 2 + mw * (ovenIndex + 0.5)
  k.box(m.black, Math.min(0.56, mw - 0.04), 0.008, 0.5, hobX, top, 0.02)
  for (const [dx, dz, r] of [[-0.13, -0.1, 0.075], [0.13, -0.1, 0.06], [-0.13, 0.13, 0.06], [0.13, 0.13, 0.085]]) {
    k.cyl(m.burner, r, r, 0.006, hobX + dx, top + 0.008, dz + 0.02, 24)
  }

  // мойка со смесителем
  const sinkX = -length / 2 + mw * (sinkIndex + 0.5)
  k.box(m.steel, Math.min(0.5, mw - 0.08), 0.01, 0.42, sinkX, top, 0.02)
  k.box(m.dark, Math.min(0.4, mw - 0.16), 0.012, 0.32, sinkX, top + 0.002, 0.02)
  k.cyl(m.chrome, 0.018, 0.022, 0.32, sinkX, top, back + 0.1)
  k.box(m.chrome, 0.03, 0.03, 0.2, sinkX, top + 0.29, back + 0.19)

  // фартук из плитки
  k.box(tile(m.kitchenTileMap, length, 0.6, 0.25), length, 0.6, 0.015, 0, top, back + 0.008)

  // верхние шкафы, над плитой — вытяжка
  for (let i = 0; i < modules; i++) {
    const x = -length / 2 + mw * (i + 0.5)
    if (i === ovenIndex) {
      k.box(m.steel, mw - 0.06, 0.08, 0.45, x, 1.62, back + 0.225)
      k.box(m.steel, 0.26, 0.6, 0.24, x, 1.7, back + 0.12)
      k.box(m.lamp, 0.12, 0.01, 0.05, x, 1.615, back + 0.35)
    } else {
      k.box(m.cabinet, mw - 0.01, 0.7, 0.33, x, 1.6, back + 0.165)
      k.box(m.cabinetFront, mw - 0.03, 0.66, 0.02, x, 1.62, back + 0.34)
      k.box(m.chrome, 0.2, 0.02, 0.02, x, 1.66, back + 0.36)
    }
  }
}

export function fridge(k: Kit, m: Materials) {
  k.box(m.steel, 0.62, 1.95, 0.64, 0, FLOOR, 0)
  k.box(m.dark, 0.6, 0.012, 0.01, 0, FLOOR + 1.25, 0.32) // разделитель дверей
  k.box(m.chrome, 0.025, 0.4, 0.03, 0.24, FLOOR + 1.35, 0.34)
  k.box(m.chrome, 0.025, 0.6, 0.03, 0.24, FLOOR + 0.55, 0.34)
}

/** Обеденная группа: стол на ножках, стулья, ваза с фруктами и подвесной светильник. */
export function diningSet(k: Kit, m: Materials, seating: "four" | "ends" = "four") {
  const tw = 1.2
  const td = 0.8
  k.box(m.lightWood, tw, 0.04, td, 0, FLOOR + 0.72, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(m.dark, 0.05, 0.72, 0.05, sx * (tw / 2 - 0.08), FLOOR, sz * (td / 2 - 0.08))

  const seats: [number, number, number][] =
    seating === "four"
      ? [[-0.3, 0.55, Math.PI], [0.3, 0.55, Math.PI], [-0.3, -0.55, 0], [0.3, -0.55, 0]]
      : [[-0.85, 0, Math.PI / 2], [0.85, 0, -Math.PI / 2]]
  for (const [x, z, rot] of seats) chair(k.child(x, 0, z, rot), m)

  // фрукты в чаше
  k.cyl(m.ceramic, 0.13, 0.08, 0.06, 0, FLOOR + 0.76, 0)
  m.fruit.forEach((mat, i) => k.sphere(mat, 0.045, Math.cos(i * 2.1) * 0.05, FLOOR + 0.84, Math.sin(i * 2.1) * 0.05))

  // подвесной светильник
  k.cyl(m.dark, 0.005, 0.005, 0.5, 0, 2.1, 0, 6)
  k.cyl(m.dark, 0.06, 0.2, 0.18, 0, 1.92, 0)
  k.sphere(m.lamp, 0.06, 0, 1.94, 0)
}

/** Стул: сиденье, четыре ножки, спинка (сзади = -z). */
export function chair(k: Kit, m: Materials, material: THREE.Material = m.dark) {
  k.box(material, 0.42, 0.04, 0.42, 0, FLOOR + 0.44, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(m.dark, 0.035, 0.44, 0.035, sx * 0.18, FLOOR, sz * 0.18)
  k.box(material, 0.42, 0.42, 0.04, 0, FLOOR + 0.48, -0.19)
}

// ───────────────────────── Санузел ─────────────────────────

/** Ванна (полая, с водой), смеситель и душевая стойка со стеклянной шторкой. */
export function bathtub(k: Kit, m: Materials) {
  const w = 1.7
  const d = 0.75
  const h = 0.55
  const t = 0.08
  k.box(m.ceramic, w, h, t, 0, FLOOR, -d / 2 + t / 2)
  k.box(m.ceramic, w, h, t, 0, FLOOR, d / 2 - t / 2)
  k.box(m.ceramic, t, h, d, -w / 2 + t / 2, FLOOR, 0)
  k.box(m.ceramic, t, h, d, w / 2 - t / 2, FLOOR, 0)
  k.box(m.ceramic, w - 0.1, 0.12, d - 0.1, 0, FLOOR, 0)
  k.box(m.water, w - 2 * t, 0.02, d - 2 * t, 0, FLOOR + 0.38, 0)
  // смеситель и душ
  k.box(m.chrome, 0.12, 0.05, 0.08, -w / 2 + 0.15, FLOOR + 0.7, -d / 2 + 0.04)
  k.cyl(m.chrome, 0.012, 0.012, 1.25, -w / 2 + 0.15, FLOOR + 0.75, -d / 2 + 0.04, 8)
  k.cyl(m.chrome, 0.09, 0.06, 0.025, -w / 2 + 0.15, FLOOR + 1.98, -d / 2 + 0.14)
  k.box(m.glass, 0.8, 1.4, 0.015, -w / 2 + 0.45, FLOOR + h, d / 2 - 0.02)
  // полотенце на бортике
  k.box(m.towel, 0.4, 0.04, 0.25, w / 2 - 0.3, FLOOR + h, d / 2 - 0.15)
}

/** Унитаз: чаша, сиденье с крышкой, бачок с кнопкой (бачок сзади). */
export function toilet(k: Kit, m: Materials) {
  const bowl = k.cyl(m.ceramic, 0.19, 0.14, 0.4, 0, FLOOR, 0.05)
  bowl.scale.z = 1.35
  const seat = k.cyl(m.ceramic, 0.2, 0.2, 0.03, 0, FLOOR + 0.4, 0.06)
  seat.scale.z = 1.3
  const hole = k.cyl(m.water, 0.12, 0.12, 0.005, 0, FLOOR + 0.43, 0.08)
  hole.scale.z = 1.3
  k.box(m.ceramic, 0.4, 0.38, 0.18, 0, FLOOR + 0.38, -0.22)
  k.box(m.ceramic, 0.42, 0.03, 0.2, 0, FLOOR + 0.76, -0.22)
  k.cyl(m.chrome, 0.035, 0.035, 0.012, 0, FLOOR + 0.79, -0.22)
}

/** Тумба с раковиной, смеситель, зеркало с подсветкой. */
export function vanity(k: Kit, m: Materials) {
  k.box(m.furnitureWood, 0.6, 0.6, 0.45, 0, FLOOR + 0.2, 0)
  k.box(m.lightWood, 0.27, 0.54, 0.02, -0.145, FLOOR + 0.23, 0.23)
  k.box(m.lightWood, 0.27, 0.54, 0.02, 0.145, FLOOR + 0.23, 0.23)
  k.box(m.ceramic, 0.62, 0.04, 0.47, 0, FLOOR + 0.8, 0)
  const basin = k.cyl(m.ceramic, 0.2, 0.15, 0.12, 0, FLOOR + 0.84, 0.03)
  basin.scale.z = 0.8
  k.cyl(m.water, 0.16, 0.16, 0.005, 0, FLOOR + 0.95, 0.03)
  k.cyl(m.chrome, 0.015, 0.02, 0.22, 0, FLOOR + 0.84, -0.17)
  k.box(m.chrome, 0.025, 0.025, 0.12, 0, FLOOR + 1.03, -0.12)
  // зеркало и светильник
  k.box(m.frame, 0.64, 0.84, 0.02, 0, 1.1, -0.215)
  k.box(m.mirror, 0.58, 0.78, 0.02, 0, 1.13, -0.205)
  k.box(m.lamp, 0.5, 0.03, 0.04, 0, 1.98, -0.19)
}

/** Стиральная машина с круглым люком. */
export function washer(k: Kit, m: Materials) {
  k.box(m.ceramic, 0.6, 0.85, 0.56, 0, FLOOR, 0)
  const door = k.cyl(m.chrome, 0.2, 0.2, 0.03, 0, FLOOR + 0.42, 0.29)
  door.rotation.x = Math.PI / 2
  door.position.y = FLOOR + 0.42
  const glass = k.cyl(m.black, 0.15, 0.15, 0.04, 0, FLOOR + 0.42, 0.29)
  glass.rotation.x = Math.PI / 2
  glass.position.y = FLOOR + 0.42
  k.box(m.dark, 0.5, 0.06, 0.01, 0, FLOOR + 0.74, 0.285)
  k.cyl(m.steel, 0.03, 0.03, 0.02, 0.18, FLOOR + 0.74, 0.28)
}

/** Полотенцесушитель «лесенка» с полотенцем. */
export function towelRail(k: Kit, m: Materials) {
  for (const x of [-0.22, 0.22]) k.box(m.chrome, 0.025, 0.8, 0.025, x, 0.9, 0)
  for (let i = 0; i < 5; i++) k.box(m.chrome, 0.44, 0.018, 0.018, 0, 0.95 + i * 0.17, 0)
  k.box(m.towel, 0.4, 0.45, 0.03, 0, 1.15, 0.03)
}

// ───────────────────────── Гостиная ─────────────────────────

/** Диван с подушками сиденья и спинки, подлокотниками и ножками. */
export function sofa(k: Kit, m: Materials, length: number) {
  const d = 0.92
  const seats = Math.max(2, Math.round((length - 0.3) / 0.7))
  const seatW = (length - 0.3) / seats
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(m.dark, 0.05, 0.08, 0.05, sx * (length / 2 - 0.1), FLOOR, sz * (d / 2 - 0.1))
  k.box(m.fabric, length, 0.22, d, 0, FLOOR + 0.08, 0)
  k.box(m.fabric, length, 0.55, 0.2, 0, FLOOR + 0.3, -d / 2 + 0.1)
  for (const sx of [-1, 1]) k.box(m.fabric, 0.15, 0.36, d, sx * (length / 2 - 0.075), FLOOR + 0.3, 0)
  for (let i = 0; i < seats; i++) {
    const x = -length / 2 + 0.15 + seatW * (i + 0.5)
    k.box(m.fabricLight, seatW - 0.03, 0.14, d - 0.26, x, FLOOR + 0.3, 0.08)
    k.box(m.fabricLight, seatW - 0.05, 0.38, 0.14, x, FLOOR + 0.44, -d / 2 + 0.25).rotation.x = -0.15
  }
  // декоративные подушки
  k.box(m.mustard, 0.38, 0.36, 0.12, -length / 2 + 0.4, FLOOR + 0.44, -d / 2 + 0.38).rotation.z = 0.15
  k.box(m.accent, 0.36, 0.34, 0.12, length / 2 - 0.4, FLOOR + 0.44, -d / 2 + 0.38).rotation.z = -0.12
}

/** Журнальный столик с книгами и кружкой. */
export function coffeeTable(k: Kit, m: Materials) {
  k.box(m.lightWood, 1.0, 0.04, 0.55, 0, FLOOR + 0.38, 0)
  k.box(m.lightWood, 0.9, 0.03, 0.45, 0, FLOOR + 0.12, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(m.dark, 0.04, 0.38, 0.04, sx * 0.45, FLOOR, sz * 0.23)
  k.box(m.books[1], 0.24, 0.03, 0.18, -0.22, FLOOR + 0.42, 0.02)
  k.box(m.books[2], 0.22, 0.03, 0.16, -0.21, FLOOR + 0.45, 0.03)
  k.cyl(m.ceramic, 0.04, 0.035, 0.09, 0.25, FLOOR + 0.42, -0.05)
}

/** ТВ-тумба и телевизор с «заставкой». */
export function tvUnit(k: Kit, m: Materials, length: number) {
  k.box(m.dark, length, 0.45, 0.4, 0, FLOOR + 0.05, 0)
  for (let i = 0; i < 3; i++) k.box(m.lightWood, length / 3 - 0.02, 0.4, 0.02, -length / 3 + (i * length) / 3, FLOOR + 0.07, 0.2)
  k.box(m.black, 0.25, 0.02, 0.18, 0, FLOOR + 0.5, -0.04)
  k.box(m.black, 0.04, 0.12, 0.04, 0, FLOOR + 0.5, -0.04)
  k.box(m.black, 1.25, 0.74, 0.05, 0, FLOOR + 0.6, -0.04)
  k.box(m.screen, 1.2, 0.69, 0.01, 0, FLOOR + 0.625, -0.01)
  // колонка и растение на тумбе
  k.box(m.black, 0.12, 0.3, 0.12, -length / 2 + 0.15, FLOOR + 0.5, 0)
}

/** Стеллаж с книгами. */
export function bookshelf(k: Kit, m: Materials, width: number) {
  const h = 1.9
  const d = 0.32
  k.box(m.lightWood, 0.03, h, d, -width / 2, FLOOR, 0)
  k.box(m.lightWood, 0.03, h, d, width / 2, FLOOR, 0)
  k.box(m.lightWood, width, 0.02, d, 0, FLOOR + h - 0.02, 0)
  k.box(m.lightWood, width, h, 0.01, 0, FLOOR, -d / 2)
  for (let s = 0; s < 5; s++) {
    const y = FLOOR + s * 0.38
    k.box(m.lightWood, width, 0.02, d, 0, y, 0)
    if (s === 4) continue
    let x = -width / 2 + 0.05
    let i = s * 3
    while (x < width / 2 - 0.12) {
      const bw = 0.03 + ((i * 7) % 4) * 0.01
      const bh = 0.22 + ((i * 5) % 5) * 0.025
      if ((i + s) % 7 !== 6) k.box(m.books[i % m.books.length], bw, bh, 0.2, x + bw / 2, y + 0.02, 0.02)
      x += bw + 0.005
      i++
    }
  }
}

export function floorLamp(k: Kit, m: Materials) {
  k.cyl(m.dark, 0.14, 0.14, 0.02, 0, FLOOR, 0)
  k.cyl(m.dark, 0.012, 0.012, 1.45, 0, FLOOR + 0.02, 0, 8)
  k.cyl(m.lamp, 0.13, 0.2, 0.28, 0, FLOOR + 1.4, 0)
}

export function plant(k: Kit, m: Materials, size = 1) {
  k.cyl(m.pot, 0.16 * size, 0.12 * size, 0.32 * size, 0, FLOOR, 0)
  k.cyl(m.dark, 0.15 * size, 0.15 * size, 0.01, 0, FLOOR + 0.3 * size, 0)
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05
    const leaf = k.sphere(i % 2 ? m.plant : m.plantDark, 0.14 * size, Math.cos(a) * 0.12 * size, FLOOR + (0.5 + (i % 3) * 0.12) * size, Math.sin(a) * 0.12 * size)
    leaf.scale.set(0.7, 1.4, 0.7)
  }
}

/** Картина на стене (задняя сторона — к стене). */
export function painting(k: Kit, m: Materials, seed: number, w = 0.7, h = 0.9) {
  k.box(m.dark, w, h, 0.03, 0, 0, 0)
  k.box(m.art[seed % m.art.length], w - 0.08, h - 0.08, 0.01, 0, 0.04, 0.02)
}

export function rug(k: Kit, material: THREE.Material, w: number, d: number) {
  k.box(material, w, 0.012, d, 0, FLOOR, 0)
}

// ───────────────────────── Спальня ─────────────────────────

/** Кровать изголовьем к стене (-z): ножки, матрас, одеяло, подушки. */
export function bed(k: Kit, m: Materials, width: number, duvet: THREE.Material) {
  const len = 2.05
  const back = -len / 2
  for (const sx of [-1, 1]) for (const z of [back + 0.1, len / 2 - 0.1]) k.box(m.dark, 0.05, 0.12, 0.05, sx * (width / 2 - 0.06), FLOOR, z)
  k.box(m.furnitureWood, width, 0.22, len, 0, FLOOR + 0.12, 0)
  k.box(m.fabric, width + 0.06, 1.05, 0.1, 0, FLOOR, back + 0.05) // мягкое изголовье
  k.box(m.linen, width - 0.06, 0.2, len - 0.12, 0, FLOOR + 0.34, 0.04)
  k.box(duvet, width - 0.02, 0.08, len * 0.62, 0, FLOOR + 0.52, len * 0.17).rotation.x = 0.02
  const pillows = width > 1.2 ? [-width / 4, width / 4] : [0]
  for (const x of pillows) {
    const p = k.box(m.linen, Math.min(0.6, width / pillows.length - 0.1), 0.13, 0.38, x, FLOOR + 0.54, back + 0.32)
    p.rotation.x = -0.25
  }
}

/** Прикроватная тумба с лампой. */
export function nightstand(k: Kit, m: Materials) {
  k.box(m.furnitureWood, 0.45, 0.5, 0.4, 0, FLOOR, 0)
  k.box(m.lightWood, 0.4, 0.18, 0.02, 0, FLOOR + 0.27, 0.2)
  k.box(m.chrome, 0.12, 0.015, 0.02, 0, FLOOR + 0.36, 0.215)
  k.cyl(m.ceramic, 0.06, 0.08, 0.2, 0, FLOOR + 0.5, -0.05)
  k.cyl(m.lamp, 0.09, 0.14, 0.18, 0, FLOOR + 0.7, -0.05)
}

/** Шкаф с распашными дверями. */
export function wardrobe(k: Kit, m: Materials, width: number) {
  const h = 2.2
  k.box(m.lightWood, width, h, 0.6, 0, FLOOR, 0)
  const doors = Math.max(2, Math.round(width / 0.5))
  const dw = width / doors
  for (let i = 0; i < doors; i++) {
    const x = -width / 2 + dw * (i + 0.5)
    k.box(m.cabinetFront, dw - 0.015, h - 0.06, 0.02, x, FLOOR + 0.03, 0.3)
    const side = i % 2 === 0 ? 1 : -1
    k.box(m.chrome, 0.02, 0.3, 0.025, x + side * (dw / 2 - 0.06), FLOOR + 0.9, 0.32)
  }
}

/** Письменный стол с ноутбуком, лампой и стулом. */
export function desk(k: Kit, m: Materials, width = 1.2) {
  k.box(m.lightWood, width, 0.04, 0.6, 0, FLOOR + 0.72, 0)
  k.box(m.cabinet, 0.4, 0.72, 0.56, width / 2 - 0.22, FLOOR, 0)
  for (const z of [-0.25, 0.25]) k.box(m.dark, 0.04, 0.72, 0.04, -width / 2 + 0.05, FLOOR, z)
  // ноутбук
  k.box(m.steel, 0.34, 0.015, 0.24, -0.1, FLOOR + 0.76, 0.05)
  const lid = k.box(m.steel, 0.34, 0.22, 0.01, -0.1, FLOOR + 0.775, -0.07)
  lid.rotation.x = -0.25
  k.box(m.screen, 0.3, 0.18, 0.005, -0.1, FLOOR + 0.795, -0.06).rotation.x = -0.25
  // лампа
  k.cyl(m.dark, 0.07, 0.07, 0.02, width / 2 - 0.2, FLOOR + 0.76, -0.15)
  k.cyl(m.dark, 0.01, 0.01, 0.35, width / 2 - 0.2, FLOOR + 0.78, -0.15, 6)
  k.cyl(m.lamp, 0.04, 0.09, 0.1, width / 2 - 0.2, FLOOR + 1.08, -0.1)
  chair(k.child(-0.1, 0, 0.55, Math.PI), m, m.accent)
}

/** Ящик с игрушками: кубики и мяч. */
export function toys(k: Kit, m: Materials) {
  k.box(m.toys[2], 0.6, 0.35, 0.4, 0, FLOOR, 0)
  k.box(m.toys[1], 0.62, 0.03, 0.42, 0, FLOOR + 0.35, 0)
  m.toys.forEach((mat, i) => k.box(mat, 0.12, 0.12, 0.12, -0.45 + (i % 2) * 0.15, FLOOR + Math.floor(i / 2) * 0.12, 0.35))
  k.sphere(m.toys[0], 0.12, 0.45, FLOOR + 0.12, 0.35)
}

// ───────────────────────── Прихожая ─────────────────────────

/** Вешалка с крючками, куртками и полкой. */
export function coatRack(k: Kit, m: Materials, width: number) {
  k.box(m.lightWood, width, 1.1, 0.03, 0, 1.0, -0.15)
  k.box(m.lightWood, width, 0.03, 0.3, 0, 1.85, 0)
  const hooks = Math.max(2, Math.floor(width / 0.25))
  for (let i = 0; i < hooks; i++) {
    const x = -width / 2 + (width / hooks) * (i + 0.5)
    k.box(m.chrome, 0.02, 0.02, 0.08, x, 1.65, -0.1)
    if (i < m.coats.length) k.box(m.coats[i], 0.36, 0.75, 0.14, x, 0.9, -0.05)
  }
}

/** Обувница с обувью. */
export function shoeBench(k: Kit, m: Materials, width = 0.9) {
  k.box(m.furnitureWood, width, 0.45, 0.32, 0, FLOOR, 0)
  k.box(m.fabricLight, width, 0.06, 0.32, 0, FLOOR + 0.45, 0)
  for (let i = 0; i < 3; i++) k.box(i % 2 ? m.dark : m.coats[1], 0.12, 0.1, 0.28, -width / 2 + 0.2 + i * 0.25, FLOOR, 0.3)
}

export function wallMirror(k: Kit, m: Materials) {
  k.box(m.furnitureWood, 0.55, 1.4, 0.03, 0, 0.55, 0)
  k.box(m.mirror, 0.47, 1.32, 0.01, 0, 0.59, 0.02)
}

// ───────────────────────── Стройка ─────────────────────────

export function bricksPallet(k: Kit, m: Materials) {
  k.box(m.pallet, 1.0, 0.12, 1.0, 0, FLOOR, 0)
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4; i++) {
      const along = row % 2 === 0
      k.box(m.brick, along ? 0.88 : 0.2, 0.13, along ? 0.2 : 0.88, along ? 0 : -0.33 + i * 0.22, FLOOR + 0.12 + row * 0.14, along ? -0.33 + i * 0.22 : 0)
    }
  }
}

export function cementBags(k: Kit, m: Materials) {
  for (let i = 0; i < 4; i++) {
    const bag = k.box(m.bag, 0.62, 0.15, 0.42, (i % 2) * 0.08, FLOOR + i * 0.15, (i % 2) * -0.05)
    bag.rotation.y = i * 0.12
  }
}

export function sawhorse(k: Kit, m: Materials) {
  k.box(m.pallet, 1.3, 0.06, 0.3, 0, FLOOR + 0.72, 0)
  for (const x of [-0.5, 0.5]) for (const z of [-0.12, 0.12]) k.box(m.dark, 0.05, 0.72, 0.05, x, FLOOR, z)
  k.box(m.steel, 0.35, 0.15, 0.2, 0.2, FLOOR + 0.78, 0) // ящик с инструментом
}

export function trafficCone(k: Kit, m: Materials) {
  k.box(m.cone, 0.32, 0.03, 0.32, 0, FLOOR, 0)
  k.cyl(m.cone, 0.03, 0.15, 0.55, 0, FLOOR + 0.03, 0)
  k.cyl(m.coneStripe, 0.075, 0.1, 0.08, 0, FLOOR + 0.27, 0)
}

function tile(map: THREE.Texture, w: number, h: number, size: number) {
  const texture = map.clone()
  texture.needsUpdate = true
  texture.repeat.set(w / size, h / size)
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4 })
}
