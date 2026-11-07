import * as THREE from "three"

/**
 * Базовые «кирпичики» для процедурного интерьера: материалы, текстуры и примитивы.
 * Все размеры — в метрах, y — вверх от чистого пола.
 */

// ───────────────────────── Текстуры ─────────────────────────

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext("2d")!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

/** Паркетная доска: полосы с лёгкими вариациями тона. */
function woodTexture() {
  return canvasTexture(256, 256, (ctx) => {
    const planks = 8
    const h = 256 / planks
    for (let i = 0; i < planks; i++) {
      const tone = 150 + ((i * 37) % 40)
      ctx.fillStyle = `rgb(${tone + 30}, ${tone - 10}, ${tone - 60})`
      ctx.fillRect(0, i * h, 256, h)
      // торцевой стык доски
      const seam = (i * 97) % 256
      ctx.fillStyle = "rgba(60, 35, 15, 0.45)"
      ctx.fillRect(seam, i * h, 2, h)
      ctx.fillRect(0, i * h, 256, 1.5)
      // волокна
      ctx.strokeStyle = "rgba(90, 55, 25, 0.18)"
      for (let k = 0; k < 4; k++) {
        ctx.beginPath()
        const y = i * h + 4 + k * (h / 4)
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(80, y + 2, 170, y - 2, 256, y + 1)
        ctx.stroke()
      }
    }
  })
}

/** Плитка с затиркой. */
function tileTexture(base: string, grout: string, count = 4) {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = grout
    ctx.fillRect(0, 0, 256, 256)
    const size = 256 / count
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        ctx.fillStyle = base
        ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4)
        const g = ctx.createLinearGradient(x * size, y * size, (x + 1) * size, (y + 1) * size)
        g.addColorStop(0, "rgba(255,255,255,0.18)")
        g.addColorStop(1, "rgba(0,0,0,0.06)")
        ctx.fillStyle = g
        ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4)
      }
    }
  })
}

/** Экран телевизора: «заставка» с горами и небом. */
function screenTexture() {
  return canvasTexture(256, 144, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 144)
    sky.addColorStop(0, "#1e3a8a")
    sky.addColorStop(1, "#f472b6")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, 256, 144)
    ctx.fillStyle = "#fde68a"
    ctx.beginPath()
    ctx.arc(180, 70, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#312e81"
    ctx.beginPath()
    ctx.moveTo(0, 144)
    ctx.lineTo(60, 80)
    ctx.lineTo(120, 120)
    ctx.lineTo(190, 70)
    ctx.lineTo(256, 130)
    ctx.lineTo(256, 144)
    ctx.fill()
  })
}

/** Абстрактная картина в рамку. */
function artTexture(seed: number) {
  const palettes = [
    ["#f59e0b", "#ef4444", "#1e293b", "#fef3c7"],
    ["#0ea5e9", "#22c55e", "#f8fafc", "#0f172a"],
    ["#a855f7", "#f472b6", "#fde68a", "#1e1b4b"],
  ]
  const [a, b, c, bg] = palettes[seed % palettes.length]
  return canvasTexture(128, 160, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 128, 160)
    ctx.fillStyle = a
    ctx.beginPath()
    ctx.arc(45, 60, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = b
    ctx.fillRect(60, 80, 52, 60)
    ctx.strokeStyle = c
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(10, 140)
    ctx.quadraticCurveTo(64, 90, 118, 30)
    ctx.stroke()
  })
}

// ───────────────────────── Материалы ─────────────────────────

export function createMaterials(plaster: boolean) {
  const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra })
  const glow = (color: string, intensity = 1) =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 })

  return {
    // конструктив
    concrete: std("#8b9099", { roughness: 1 }),
    wall: std(plaster ? "#f2efe8" : "#a3a8b0", { roughness: 0.95 }),
    outerWall: std(plaster ? "#e4ded3" : "#979ca5", { roughness: 0.95 }),
    markup: glow("#60a5fa", 0.6),
    glass: new THREE.MeshStandardMaterial({ color: "#bfdbfe", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3 }),
    frame: std("#f1f5f9", { roughness: 0.4 }),
    door: std("#f5f0e6", { roughness: 0.5 }),
    entranceDoor: std("#5b4636", { roughness: 0.6 }),
    // отделка
    woodMap: woodTexture(),
    floorTileMap: tileTexture("#d6dde4", "#9aa5b1", 4),
    wallTileMap: tileTexture("#e0f2fe", "#94a3b8", 6),
    kitchenTileMap: tileTexture("#efe7da", "#b8ab97", 5),
    // мебель
    furnitureWood: std("#8b5e3c", { roughness: 0.6 }),
    lightWood: std("#d6b98c", { roughness: 0.6 }),
    cabinet: std("#f8fafc", { roughness: 0.35 }),
    cabinetFront: std("#e2e8f0", { roughness: 0.3 }),
    fabric: std("#5b6b82", { roughness: 1 }),
    fabricLight: std("#7c8ba1", { roughness: 1 }),
    accent: std("#3b82f6", { roughness: 1 }),
    mustard: std("#d4a017", { roughness: 1 }),
    linen: std("#eef2f7", { roughness: 1 }),
    duvet: std("#c7d2fe", { roughness: 1 }),
    kidsDuvet: std("#fca5a5", { roughness: 1 }),
    rug: std("#9f7e69", { roughness: 1 }),
    kidsRug: std("#86efac", { roughness: 1 }),
    curtain: std("#e7dcc8", { roughness: 1 }),
    dark: std("#1f2937", { roughness: 0.4 }),
    black: std("#0b0f17", { roughness: 0.2, metalness: 0.2 }),
    stone: std("#4b5563", { roughness: 0.35 }),
    ceramic: std("#ffffff", { roughness: 0.12 }),
    chrome: std("#e5e7eb", { roughness: 0.15, metalness: 1 }),
    steel: std("#cbd5e1", { roughness: 0.3, metalness: 0.6 }),
    mirror: std("#dbeafe", { roughness: 0.02, metalness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: "#7dd3fc", roughness: 0.05, transparent: true, opacity: 0.6 }),
    screen: new THREE.MeshStandardMaterial({ map: screenTexture(), emissive: "#ffffff", emissiveIntensity: 0.55, roughness: 0.2 }),
    lamp: glow("#fde68a", 1.2),
    burner: std("#374151", { roughness: 0.6 }),
    plant: std("#16a34a", { roughness: 0.9 }),
    plantDark: std("#166534", { roughness: 0.9 }),
    pot: std("#c2410c", { roughness: 0.8 }),
    towel: std("#38bdf8", { roughness: 1 }),
    books: ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#f8fafc"].map((c) => std(c, { roughness: 0.9 })),
    coats: ["#334155", "#b45309", "#0f766e"].map((c) => std(c, { roughness: 1 })),
    toys: ["#ef4444", "#facc15", "#3b82f6", "#22c55e"].map((c) => std(c, { roughness: 0.5 })),
    art: [0, 1, 2].map((i) => new THREE.MeshStandardMaterial({ map: artTexture(i), roughness: 0.8 })),
    fruit: ["#f97316", "#84cc16", "#ef4444"].map((c) => std(c, { roughness: 0.5 })),
    // стройка
    brick: std("#b45309", { roughness: 0.9 }),
    pallet: std("#a16207", { roughness: 1 }),
    bag: std("#d6d3d1", { roughness: 1 }),
    cone: glow("#f97316", 0.25),
    coneStripe: std("#f8fafc", { roughness: 0.6 }),
  }
}

export type Materials = ReturnType<typeof createMaterials>

/** Материал с картой, повторённой под размер поверхности (метры → плитки). */
export function tiled(map: THREE.Texture, width: number, height: number, tileSize: number, roughness = 0.6) {
  const texture = map.clone()
  texture.needsUpdate = true
  texture.repeat.set(width / tileSize, height / tileSize)
  return new THREE.MeshStandardMaterial({ map: texture, roughness })
}

// ───────────────────────── Примитивы ─────────────────────────

/** Обёртка над группой: компактные вызовы box/cyl/sphere. */
export class Kit {
  readonly group: THREE.Group

  constructor(group = new THREE.Group()) {
    this.group = group
  }

  /** Коробка: (x, z) — центр, y — низ. */
  box(material: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001)), material)
    mesh.position.set(x, y + h / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
    return mesh
  }

  /** Цилиндр: y — низ. */
  cyl(material: THREE.Material, rTop: number, rBottom: number, h: number, x = 0, y = 0, z = 0, segments = 20) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material)
    mesh.position.set(x, y + h / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
    return mesh
  }

  sphere(material: THREE.Material, r: number, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    this.group.add(mesh)
    return mesh
  }

  /** Вложенная группа, удобна для поворота готового предмета. */
  child(x = 0, y = 0, z = 0, rotY = 0) {
    const kit = new Kit()
    kit.group.position.set(x, y, z)
    kit.group.rotation.y = rotY
    this.group.add(kit.group)
    return kit
  }
}
