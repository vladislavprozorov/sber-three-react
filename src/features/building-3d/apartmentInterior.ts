import * as THREE from "three"
import type { RoomSnapshot } from "../building-info/floorService"
import {
  CEILING,
  getApartmentLayout,
  getBuildState,
  type ApartmentRoom,
  type WallSegment,
} from "../apartment/apartmentLayout"

/**
 * Процедурный интерьер квартиры. Строится в метрах (y — вверх от пола),
 * масштаб в единицы сцены задаёт вызывающий код.
 */

type Materials = ReturnType<typeof createMaterials>

function createMaterials(plaster: boolean) {
  const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra })
  return {
    concrete: std("#8b9099", { roughness: 1 }),
    wall: std(plaster ? "#f2efe8" : "#a3a8b0", { roughness: 0.95 }),
    outerWall: std(plaster ? "#e4ded3" : "#979ca5", { roughness: 0.95 }),
    markup: std("#60a5fa", { emissive: "#60a5fa", emissiveIntensity: 0.6 }),
    wood: std("#b07d4f", { roughness: 0.7 }),
    tile: std("#cbd5e1", { roughness: 0.4 }),
    kitchenTile: std("#e5dccb", { roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: "#93c5fd", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35 }),
    frame: std("#e5e7eb", { roughness: 0.5 }),
    furnitureWood: std("#8b5e3c", { roughness: 0.6 }),
    lightWood: std("#d6b98c", { roughness: 0.6 }),
    fabric: std("#5b6b82", { roughness: 1 }),
    accent: std("#3b82f6", { roughness: 1 }),
    linen: std("#eef2f7", { roughness: 1 }),
    rug: std("#9f7e69", { roughness: 1 }),
    white: std("#f8fafc", { roughness: 0.3 }),
    dark: std("#1f2937", { roughness: 0.4 }),
    steel: std("#cbd5e1", { roughness: 0.3, metalness: 0.6 }),
    stone: std("#4b5563", { roughness: 0.4 }),
    plant: std("#16a34a", { roughness: 0.9 }),
    brick: std("#b45309", { roughness: 0.9 }),
    pallet: std("#a16207", { roughness: 1 }),
    bag: std("#d6d3d1", { roughness: 1 }),
    cone: std("#f97316", { roughness: 0.6, emissive: "#f97316", emissiveIntensity: 0.25 }),
  }
}

/** Коробка по габаритам: (x, z) — центр, y — низ. */
function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  if (w <= 0.001 || h <= 0.001 || d <= 0.001) return null
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y + h / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

// ───────────────────────── Стены ─────────────────────────

function addWall(group: THREE.Group, wall: WallSegment, height: number, m: Materials, windows: boolean) {
  const thickness = wall.outer ? 0.25 : 0.12
  const material = wall.outer ? m.outerWall : m.wall

  // Кусок стены вдоль оси от a до b, по высоте от y0 до y1
  const piece = (a: number, b: number, y0: number, y1: number, mat: THREE.Material = material, t = thickness) => {
    const top = Math.min(y1, height)
    if (b - a < 0.01 || top - y0 < 0.01) return
    const mid = (a + b) / 2
    if (wall.axis === "x") box(group, mat, b - a, top - y0, t, mid, y0, wall.fixed)
    else box(group, mat, t, top - y0, b - a, wall.fixed, y0, mid)
  }

  let cursor = wall.from
  for (const gap of [...wall.gaps].sort((a, b) => a.at - b.at)) {
    const start = gap.at - gap.width / 2
    const end = gap.at + gap.width / 2
    piece(cursor, start, 0, height)
    if (gap.kind === "door") {
      piece(start, end, 2.1, CEILING)
    } else {
      piece(start, end, 0, 0.85) // подоконная часть
      piece(start, end, 2.25, CEILING) // перемычка
      if (windows && height >= 2.25) {
        piece(start, end, 0.85, 2.25, m.glass, 0.04)
        piece(start - 0.02, end + 0.02, 0.85, 0.9, m.frame, thickness + 0.1) // подоконник
      }
    }
    cursor = end
  }
  piece(cursor, wall.to, 0, height)
}

function addMarkup(group: THREE.Group, wall: WallSegment, m: Materials) {
  const len = wall.to - wall.from
  const mid = (wall.from + wall.to) / 2
  if (wall.axis === "x") box(group, m.markup, len, 0.02, 0.06, mid, 0.06, wall.fixed)
  else box(group, m.markup, 0.06, 0.02, len, wall.fixed, 0.06, mid)
}

// ───────────────────────── Мебель ─────────────────────────

function center(r: ApartmentRoom) {
  return { cx: (r.x0 + r.x1) / 2, cz: (r.z0 + r.z1) / 2, rw: r.x1 - r.x0, rd: r.z1 - r.z0 }
}

const FLOOR_TOP = 0.06

function sofa(g: THREE.Group, m: Materials, x: number, z: number, length: number, facing: 1 | -1) {
  // диван вдоль оси z, спинкой к стене; facing — куда смотрит сиденье по x
  box(g, m.fabric, 0.9, 0.42, length, x, FLOOR_TOP, z)
  box(g, m.fabric, 0.22, 0.85, length, x - facing * 0.34, FLOOR_TOP, z)
  box(g, m.fabric, 0.9, 0.6, 0.16, x, FLOOR_TOP, z - length / 2 + 0.08)
  box(g, m.fabric, 0.9, 0.6, 0.16, x, FLOOR_TOP, z + length / 2 - 0.08)
  box(g, m.accent, 0.12, 0.35, 0.4, x - facing * 0.18, FLOOR_TOP + 0.42, z - length / 4)
}

function plant(g: THREE.Group, m: Materials, x: number, z: number) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.35, 12), m.white)
  pot.position.set(x, FLOOR_TOP + 0.175, z)
  pot.castShadow = true
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), m.plant)
  leaves.position.set(x, FLOOR_TOP + 0.65, z)
  leaves.castShadow = true
  g.add(pot, leaves)
}

function diningSet(g: THREE.Group, m: Materials, x: number, z: number) {
  box(g, m.lightWood, 0.8, 0.04, 1.1, x, FLOOR_TOP + 0.72, z)
  box(g, m.dark, 0.1, 0.72, 0.1, x, FLOOR_TOP, z)
  for (const dz of [-0.3, 0.3]) {
    for (const dx of [-0.6, 0.6]) {
      box(g, m.dark, 0.42, 0.45, 0.42, x + dx, FLOOR_TOP, z + dz)
      box(g, m.dark, 0.06, 0.45, 0.42, x + dx + Math.sign(dx) * 0.18, FLOOR_TOP + 0.45, z + dz)
    }
  }
}

function kitchenRun(g: THREE.Group, m: Materials, r: ApartmentRoom, from: number, length: number) {
  const x = r.x0 + 0.32
  const len = Math.min(length, r.z1 - from - 0.1)
  const z = from + len / 2
  box(g, m.white, 0.6, 0.86, len, x, FLOOR_TOP, z)
  box(g, m.stone, 0.64, 0.04, len, x, FLOOR_TOP + 0.86, z)
  box(g, m.white, 0.35, 0.7, len, r.x0 + 0.18, 1.5, z)
  box(g, m.dark, 0.5, 0.01, 0.55, x, FLOOR_TOP + 0.9, z - len / 4) // варочная панель
  box(g, m.steel, 0.4, 0.02, 0.5, x, FLOOR_TOP + 0.9, z + len / 4) // мойка
  const fridgeZ = from + len + 0.36
  if (fridgeZ + 0.33 < r.z1) box(g, m.steel, 0.65, 1.9, 0.65, r.x0 + 0.35, FLOOR_TOP, fridgeZ)
}

function furnishRoom(g: THREE.Group, r: ApartmentRoom, m: Materials) {
  const { cx, cz, rw, rd } = center(r)
  switch (r.kind) {
    case "living": {
      box(g, m.rug, Math.min(2.4, rw - 1.2), 0.01, Math.min(2.2, rd - 1.6), cx, FLOOR_TOP, cz)
      sofa(g, m, r.x0 + 0.55, cz, Math.min(2.2, rd - 1.2), 1)
      box(g, m.lightWood, 0.6, 0.38, 1.0, r.x0 + 1.55, FLOOR_TOP, cz)
      box(g, m.dark, 0.42, 0.5, 1.6, r.x1 - 0.3, FLOOR_TOP, cz)
      box(g, m.dark, 0.06, 0.75, 1.3, r.x1 - 0.3, FLOOR_TOP + 0.6, cz)
      plant(g, m, r.x1 - 0.4, r.z0 + 0.45)
      break
    }
    case "bedroom": {
      if (rw >= 3.2) {
        // кровать изголовьем к боковой стене
        const bx = r.x1 - 1.08
        box(g, m.furnitureWood, 2.05, 0.42, 1.65, bx, FLOOR_TOP, cz)
        box(g, m.furnitureWood, 0.1, 1.0, 1.65, r.x1 - 0.1, FLOOR_TOP, cz)
        box(g, m.linen, 1.95, 0.16, 1.55, bx, FLOOR_TOP + 0.42, cz)
        box(g, m.accent, 1.2, 0.05, 1.6, bx - 0.35, FLOOR_TOP + 0.58, cz)
        for (const dz of [-0.4, 0.4]) box(g, m.white, 0.35, 0.12, 0.6, r.x1 - 0.35, FLOOR_TOP + 0.58, cz + dz)
        for (const dz of [-1.1, 1.1]) box(g, m.furnitureWood, 0.42, 0.5, 0.42, r.x1 - 0.3, FLOOR_TOP, cz + dz)
        box(g, m.lightWood, 0.6, 2.1, Math.min(1.8, rd - 1.6), r.x0 + 0.35, FLOOR_TOP, cz)
      } else {
        // узкая спальня: кровать изголовьем к окну
        const bz = r.z0 + 1.12
        box(g, m.furnitureWood, 1.6, 0.42, 2.05, cx, FLOOR_TOP, bz)
        box(g, m.furnitureWood, 1.6, 1.0, 0.1, cx, FLOOR_TOP, r.z0 + 0.2)
        box(g, m.linen, 1.5, 0.16, 1.95, cx, FLOOR_TOP + 0.42, bz)
        box(g, m.accent, 1.55, 0.05, 1.2, cx, FLOOR_TOP + 0.58, bz + 0.35)
        for (const dx of [-0.38, 0.38]) box(g, m.white, 0.6, 0.12, 0.35, cx + dx, FLOOR_TOP + 0.58, r.z0 + 0.45)
        if (rd > 4) box(g, m.lightWood, Math.min(1.6, rw - 0.6), 2.1, 0.6, cx, FLOOR_TOP, r.z1 - 0.9)
      }
      break
    }
    case "kitchen": {
      kitchenRun(g, m, r, r.z0 + 0.15, Math.min(3, rd - 1))
      diningSet(g, m, Math.min(r.x1 - 0.9, cx + 0.45), cz)
      break
    }
    case "kitchen-living": {
      kitchenRun(g, m, r, r.z0 + 0.15, 2.4)
      diningSet(g, m, cx, r.z0 + 1.4)
      sofa(g, m, r.x1 - 0.55, r.z1 - 1.5, 2.0, -1)
      box(g, m.rug, 1.6, 0.01, 1.8, r.x1 - 1.6, FLOOR_TOP, r.z1 - 1.5)
      plant(g, m, r.x1 - 0.35, r.z0 + 0.4)
      break
    }
    case "bath": {
      if (rw >= 1.9) box(g, m.white, 1.7, 0.55, 0.75, cx, FLOOR_TOP, r.z0 + 0.48)
      else box(g, m.white, 0.75, 0.55, 1.7, r.x0 + 0.48, FLOOR_TOP, cz)
      box(g, m.white, 0.4, 0.42, 0.55, r.x0 + 0.35, FLOOR_TOP, r.z1 - 0.45)
      box(g, m.white, 0.4, 0.35, 0.18, r.x0 + 0.35, FLOOR_TOP + 0.42, r.z1 - 0.22)
      box(g, m.white, 0.55, 0.85, 0.45, r.x1 - 0.4, FLOOR_TOP, r.z1 - 0.35)
      box(g, m.steel, 0.5, 0.7, 0.03, r.x1 - 0.4, 1.2, r.z1 - 0.14)
      break
    }
    case "hall": {
      box(g, m.rug, Math.min(1.2, rw - 0.4), 0.01, 0.7, cx, FLOOR_TOP, r.z1 - 0.5)
      box(g, m.lightWood, Math.min(1.2, rw - 0.4), 0.9, 0.35, cx, FLOOR_TOP, r.z0 + 0.25)
      break
    }
  }
}

function addConstructionProps(g: THREE.Group, rooms: ApartmentRoom[], m: Materials, problem: boolean) {
  const big = [...rooms].sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0]
  const { cx, cz } = center(big)
  // поддон с кирпичом
  box(g, m.pallet, 1.0, 0.12, 1.0, cx - 0.5, FLOOR_TOP, cz)
  box(g, m.brick, 0.9, 0.55, 0.9, cx - 0.5, FLOOR_TOP + 0.12, cz)
  // мешки со смесью
  for (let i = 0; i < 3; i++) box(g, m.bag, 0.6, 0.16, 0.4, cx + 0.7, FLOOR_TOP + i * 0.16, cz - 0.3 + (i % 2) * 0.1)
  // козлы
  box(g, m.pallet, 1.2, 0.06, 0.3, cx + 0.5, FLOOR_TOP + 0.7, cz + 0.9)
  for (const dx of [-0.45, 0.45]) box(g, m.dark, 0.06, 0.7, 0.3, cx + 0.5 + dx, FLOOR_TOP, cz + 0.9)

  if (problem) {
    for (const [dx, dz] of [[-1.3, -0.9], [-1.3, 0.9], [0.4, -1.1]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 16), m.cone)
      cone.position.set(cx + dx, FLOOR_TOP + 0.275, cz + dz)
      cone.castShadow = true
      g.add(cone)
    }
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

export function buildApartmentInterior(apartment: RoomSnapshot): THREE.Group {
  const layout = getApartmentLayout(apartment)
  const state = getBuildState(apartment.progress)
  const m = createMaterials(state.plaster)
  const group = new THREE.Group()

  // Плита пола квартиры
  box(group, m.concrete, layout.width, 0.04, layout.depth, 0, 0, 0)

  for (const room of layout.rooms) {
    const { cx, cz, rw, rd } = center(room)
    let floor = m.concrete
    if (state.floorFinish) floor = room.kind === "bath" ? m.tile : room.kind === "kitchen" ? m.kitchenTile : m.wood
    if (floor !== m.concrete) box(group, floor, rw - 0.05, 0.02, rd - 0.05, cx, 0.04, cz)
    if (state.furniture) furnishRoom(group, room, m)
    group.add(roomLabel(room))
  }

  const height = state.wallHeight * CEILING
  for (const wall of layout.walls) {
    if (height <= 0) addMarkup(group, wall, m)
    else addWall(group, wall, height, m, state.windows)
  }

  if (apartment.progress > 0 && !state.furniture) {
    addConstructionProps(group, layout.rooms, m, apartment.status === "problem")
  }

  return group
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
