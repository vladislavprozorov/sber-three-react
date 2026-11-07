import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import {
  FLOOR_FOOTPRINT,
  STATUS_COLORS,
  type FloorSnapshot,
  type FloorStatus,
} from "../building-info/floorService"

export type FilterValue = FloorStatus | "all"

export interface HoverTarget {
  floor: number
  room: number | null
}

export interface BuildingSceneCallbacks {
  onSelectFloor?: (floorIndex: number) => void
  onSelectRoom?: (floorIndex: number, roomIndex: number) => void
  /** Вызывается на каждое движение курсора, чтобы двигать тултип. */
  onHover?: (target: HoverTarget | null, clientX: number, clientY: number) => void
}

const FLOOR_W = FLOOR_FOOTPRINT.width
const FLOOR_D = FLOOR_FOOTPRINT.depth
const FLOOR_H = 0.95
const FLOOR_STEP = 1.15
const SLAB_H = 0.12
const BASE_Y = 0.2
const WALL_H = 0.5
/** Насколько поднимаются этажи над раскрытым этажом. */
const LIFT = 4
const BG_COLOR = "#0d0f14"
const FOV = 42
const CLICK_TOLERANCE_PX = 6

interface RoomVisual {
  index: number
  tile: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  walls: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>
  label: THREE.Sprite
  targetColor: THREE.Color
  highlight: number
}

interface FloorVisual {
  index: number
  status: FloorStatus
  group: THREE.Group
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>
  slab: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  label: THREE.Sprite
  interior: THREE.Group
  rooms: RoomVisual[]
  targetColor: THREE.Color
  // текущие анимируемые значения
  emissive: number
  opacity: number
  scale: number
  growth: number
  lift: number
  open: number
}

/** Плавное приближение к цели, не зависящее от FPS. */
function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt))
}

function createWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#e9edf2"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const windows = 7
  const gap = canvas.width / windows
  for (let i = 0; i < windows; i++) {
    const x = i * gap + gap * 0.18
    const w = gap * 0.64
    const grad = ctx.createLinearGradient(0, 18, 0, 78)
    grad.addColorStop(0, "#5b6675")
    grad.addColorStop(1, "#2c333d")
    ctx.fillStyle = grad
    ctx.fillRect(x, 18, w, 60)
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    ctx.fillRect(x + w / 2 - 1.5, 18, 3, 60)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function createLabelSprite(text: string, options: { round?: boolean; size?: number } = {}): THREE.Sprite {
  const { round = true, size = 0.55 } = options
  const canvas = document.createElement("canvas")
  canvas.width = round ? 128 : 192
  canvas.height = round ? 128 : 96
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "rgba(15, 18, 25, 0.85)"
  ctx.strokeStyle = "rgba(255,255,255,0.25)"
  ctx.lineWidth = 4
  ctx.beginPath()
  if (round) ctx.arc(64, 64, 56, 0, Math.PI * 2)
  else ctx.roundRect(6, 10, 180, 76, 22)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#ffffff"
  ctx.font = `600 ${round ? 60 : 52}px Inter, system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(size * (canvas.width / canvas.height), size, 1)
  return sprite
}

/**
 * Императивный Three.js-движок сцены. Ничего не знает о React:
 * получает состояние через сеттеры, отдаёт события через коллбэки.
 */
export class BuildingScene {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly floors: FloorVisual[] = []
  private readonly resizeObserver: ResizeObserver
  private readonly reducedMotion: boolean
  private readonly buildingHeight: number
  private crane: THREE.Group | null = null

  private callbacks: BuildingSceneCallbacks = {}
  private selected: number | null = null
  private selectedRoom: number | null = null
  private hovered: number | null = null
  private hoveredRoom: number | null = null
  private filter: FilterValue = "all"

  private flight: { target: THREE.Vector3; position: THREE.Vector3 } | null = null
  private pointerDown: { x: number; y: number } | null = null
  private frameId = 0
  private lastTime = performance.now()

  constructor(container: HTMLElement, floors: FloorSnapshot[]) {
    this.container = container
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    this.buildingHeight = floors.length * FLOOR_STEP

    const { width, height } = this.size()

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.domElement.style.display = "block"
    this.renderer.domElement.style.touchAction = "none"
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(BG_COLOR)
    this.scene.fog = new THREE.Fog(BG_COLOR, 28, 60)

    this.camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 200)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 4
    this.controls.maxPolarAngle = Math.PI * 0.49
    this.controls.autoRotateSpeed = 0.6
    this.controls.addEventListener("start", this.onControlsStart)

    this.buildLights()
    this.buildEnvironment()
    this.buildFloors(floors)
    this.buildCrane()

    this.updateFog()
    const overview = this.overviewView()
    this.camera.position.copy(overview.position)
    this.controls.target.copy(overview.target)
    this.controls.autoRotate = !this.reducedMotion
    this.controls.update()

    const canvas = this.renderer.domElement
    canvas.addEventListener("pointerdown", this.onPointerDown)
    canvas.addEventListener("pointerup", this.onPointerUp)
    canvas.addEventListener("pointermove", this.onPointerMove)
    canvas.addEventListener("pointerleave", this.onPointerLeave)

    this.resizeObserver = new ResizeObserver(this.onResize)
    this.resizeObserver.observe(container)

    this.frameId = requestAnimationFrame(this.tick)
  }

  // ───────────────────────── Публичный API ─────────────────────────

  setCallbacks(callbacks: BuildingSceneCallbacks) {
    this.callbacks = callbacks
  }

  /** Обновить статусы этажей и помещений (например, при перемотке таймлайна). */
  setFloors(snapshots: FloorSnapshot[]) {
    for (const snapshot of snapshots) {
      const floor = this.floors[snapshot.floorIndex]
      if (!floor) continue
      floor.status = snapshot.status
      floor.targetColor.set(STATUS_COLORS[snapshot.status])
      for (const room of snapshot.rooms) {
        floor.rooms[room.roomIndex]?.targetColor.set(STATUS_COLORS[room.status])
      }
    }
  }

  setSelected(index: number | null) {
    if (index === this.selected) return
    this.selected = index
    this.selectedRoom = null
    this.controls.autoRotate = false
    this.flight = index === null ? this.overviewView() : this.floorView(index)
  }

  setSelectedRoom(index: number | null) {
    this.selectedRoom = index
  }

  setHovered(index: number | null) {
    this.hovered = index
  }

  setFilter(filter: FilterValue) {
    this.filter = filter
  }

  /** Вернуть камеру к общему виду здания. */
  resetView() {
    this.flight = this.overviewView()
    this.controls.autoRotate = this.selected === null && !this.reducedMotion
  }

  dispose() {
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener("pointerdown", this.onPointerDown)
    canvas.removeEventListener("pointerup", this.onPointerUp)
    canvas.removeEventListener("pointermove", this.onPointerMove)
    canvas.removeEventListener("pointerleave", this.onPointerLeave)
    this.controls.removeEventListener("start", this.onControlsStart)
    this.controls.dispose()

    const disposed = new Set<unknown>()
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry && !disposed.has(mesh.geometry)) {
        disposed.add(mesh.geometry)
        mesh.geometry.dispose()
      }
      const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
      for (const material of materials) {
        if (disposed.has(material)) continue
        disposed.add(material)
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture && !disposed.has(value)) {
            disposed.add(value)
            value.dispose()
          }
        }
        material.dispose()
      }
    })

    this.renderer.dispose()
    canvas.remove()
  }

  // ───────────────────────── Построение сцены ─────────────────────────

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight("#cfe0ff", "#1a1d24", 0.9))

    const sun = new THREE.DirectionalLight("#fff4e0", 2.2)
    sun.position.set(9, 16, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -12
    sun.shadow.camera.right = 12
    sun.shadow.camera.top = 16
    sun.shadow.camera.bottom = -6
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 50
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    this.scene.add(sun)

    const rim = new THREE.DirectionalLight("#7aa2ff", 0.6)
    rim.position.set(-10, 6, -8)
    this.scene.add(rim)
  }

  private buildEnvironment() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshStandardMaterial({ color: "#14171d", roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    const grid = new THREE.GridHelper(40, 40, "#2a2f3a", "#1c2028")
    grid.position.y = 0.002
    this.scene.add(grid)

    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(FLOOR_W + 1.2, 0.2, FLOOR_D + 1.2),
      new THREE.MeshStandardMaterial({ color: "#3a3f4a", roughness: 0.9 }),
    )
    foundation.position.y = 0.1
    foundation.receiveShadow = true
    foundation.castShadow = true
    this.scene.add(foundation)
  }

  private buildFloors(snapshots: FloorSnapshot[]) {
    const bodyGeometry = new THREE.BoxGeometry(FLOOR_W, FLOOR_H, FLOOR_D)
    const edgesGeometry = new THREE.EdgesGeometry(bodyGeometry)
    const slabGeometry = new THREE.BoxGeometry(FLOOR_W + 0.3, SLAB_H, FLOOR_D + 0.3)
    const corridorGeometry = new THREE.BoxGeometry(FLOOR_W - 0.1, 0.03, 0.66)
    const corridorMaterial = new THREE.MeshStandardMaterial({ color: "#3b4252", transparent: true, opacity: 0 })
    const windowTexture = createWindowTexture()
    const roomGeometries = new Map<string, { tile: THREE.BoxGeometry; walls: THREE.EdgesGeometry }>()

    for (const snapshot of snapshots) {
      const color = new THREE.Color(STATUS_COLORS[snapshot.status])
      const group = new THREE.Group()
      group.position.y = BASE_Y + snapshot.floorIndex * FLOOR_STEP

      const body = new THREE.Mesh(
        bodyGeometry,
        new THREE.MeshStandardMaterial({
          color,
          map: windowTexture,
          emissive: color.clone(),
          emissiveIntensity: 0,
          roughness: 0.45,
          metalness: 0.1,
          transparent: true,
        }),
      )
      body.position.y = FLOOR_H / 2
      body.castShadow = true
      body.receiveShadow = true
      body.userData.floorIndex = snapshot.floorIndex
      group.add(body)

      const edges = new THREE.LineSegments(
        edgesGeometry,
        new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.25 }),
      )
      edges.position.y = FLOOR_H / 2
      group.add(edges)

      const slab = new THREE.Mesh(
        slabGeometry,
        new THREE.MeshStandardMaterial({ color: "#6b7280", roughness: 0.8, transparent: true }),
      )
      slab.position.y = FLOOR_H + SLAB_H / 2
      slab.castShadow = true
      slab.receiveShadow = true
      group.add(slab)

      const label = createLabelSprite(String(snapshot.floorIndex + 1))
      label.position.set(-FLOOR_W / 2 - 0.55, FLOOR_H / 2, FLOOR_D / 2)
      group.add(label)

      // Интерьер: квартиры, стены и коридор. Видны только у раскрытого этажа.
      const interior = new THREE.Group()
      interior.visible = false
      const corridor = new THREE.Mesh(corridorGeometry, corridorMaterial)
      corridor.position.y = 0.02
      interior.add(corridor)

      const rooms: RoomVisual[] = snapshot.rooms.map((room) => {
        const key = `${room.width}x${room.depth}`
        let geometry = roomGeometries.get(key)
        if (!geometry) {
          geometry = {
            tile: new THREE.BoxGeometry(room.width - 0.08, 0.05, room.depth - 0.08),
            walls: new THREE.EdgesGeometry(new THREE.BoxGeometry(room.width - 0.02, WALL_H, room.depth - 0.02)),
          }
          roomGeometries.set(key, geometry)
        }
        const roomColor = new THREE.Color(STATUS_COLORS[room.status])
        const tile = new THREE.Mesh(
          geometry.tile,
          new THREE.MeshStandardMaterial({
            color: roomColor.clone(),
            emissive: roomColor.clone(),
            emissiveIntensity: 0.15,
            roughness: 0.6,
            transparent: true,
            opacity: 0,
          }),
        )
        tile.position.set(room.x, 0.04, room.z)
        tile.userData.roomIndex = room.roomIndex
        tile.receiveShadow = true

        const walls = new THREE.LineSegments(
          geometry.walls,
          new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0 }),
        )
        walls.position.set(room.x, WALL_H / 2 + 0.02, room.z)

        const roomLabel = createLabelSprite(room.number, { round: false, size: 0.26 })
        roomLabel.position.set(room.x, WALL_H + 0.25, room.z)
        roomLabel.material.opacity = 0

        interior.add(tile, walls, roomLabel)
        return { index: room.roomIndex, tile, walls, label: roomLabel, targetColor: roomColor, highlight: 0 }
      })
      group.add(interior)

      const grown = snapshot.progress > 0 ? 1 : 0
      group.scale.y = grown
      group.visible = grown > 0

      this.scene.add(group)
      this.floors.push({
        index: snapshot.floorIndex,
        status: snapshot.status,
        group,
        body,
        edges,
        slab,
        label,
        interior,
        rooms,
        targetColor: color.clone(),
        emissive: 0,
        opacity: 1,
        scale: 1,
        growth: grown,
        lift: 0,
        open: 0,
      })
    }
  }

  private buildCrane() {
    const steel = new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.6, metalness: 0.3 })
    const dark = new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.8 })
    const height = this.buildingHeight + 2.5
    const crane = new THREE.Group()
    crane.position.set(FLOOR_W / 2 + 2.2, 0, -FLOOR_D / 2 - 1)

    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.35, height, 0.35), steel)
    mast.position.y = height / 2
    mast.castShadow = true
    crane.add(mast)

    const head = new THREE.Group()
    head.position.y = height
    crane.add(head)

    const jib = new THREE.Mesh(new THREE.BoxGeometry(9, 0.28, 0.28), steel)
    jib.position.x = -3.2
    jib.castShadow = true
    head.add(jib)

    const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), dark)
    counterweight.position.set(2.2, -0.15, 0)
    head.add(counterweight)

    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), dark)
    cab.position.set(0, -0.4, 0.45)
    head.add(cab)

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 6), dark)
    cable.position.set(-5.5, -1.5, 0)
    head.add(cable)

    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), dark)
    hook.position.set(-5.5, -3.05, 0)
    head.add(hook)

    head.rotation.y = 0.6
    this.crane = head
    this.scene.add(crane)
  }

  // ───────────────────────── Камера ─────────────────────────

  private size() {
    return {
      width: this.container.clientWidth || 1,
      height: this.container.clientHeight || 1,
    }
  }

  /** Дистанция, на которой объект размером width×height целиком помещается в кадр. */
  private fitDistance(width: number, height: number) {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const byHeight = height / 2 / tanHalf
    const byWidth = width / 2 / (tanHalf * this.camera.aspect)
    return Math.max(byHeight, byWidth)
  }

  /** Горизонтальное направление от цели к камере — чтобы не «телепортировать» пользователя. */
  private viewDirection(elevation: number) {
    const dir = this.camera.position.clone().sub(this.controls.target)
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 1.4)
    dir.normalize()
    dir.y = elevation
    return dir.normalize()
  }

  private overviewView() {
    const target = new THREE.Vector3(0, this.buildingHeight / 2, 0)
    // В портретном кадре кран можно обрезать, иначе здание станет слишком мелким
    const width = this.camera.aspect < 1 ? FLOOR_W + 2 : FLOOR_W + 9
    const distance = this.fitDistance(width, this.buildingHeight + 4) + FLOOR_D / 2
    const position = target.clone().addScaledVector(this.viewDirection(0.35), distance)
    return { target, position }
  }

  /** Вид сверху-сбоку на раскрытый этаж: этажи выше приподнимаются, видна планировка. */
  private floorView(index: number) {
    const y = BASE_Y + index * FLOOR_STEP + FLOOR_H / 3
    const target = new THREE.Vector3(0, y, 0)
    const distance = this.fitDistance(FLOOR_W + 1.5, FLOOR_D + 2.5) + 1
    const position = target.clone().addScaledVector(this.viewDirection(1.25), distance)
    return { target, position }
  }

  // ───────────────────────── События ─────────────────────────

  private onControlsStart = () => {
    this.flight = null
    this.controls.autoRotate = false
  }

  private onResize = () => {
    const { width, height } = this.size()
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.updateFog()
  }

  /** Туман начинается за зданием, на какой бы дистанции ни стояла камера. */
  private updateFog() {
    const fog = this.scene.fog as THREE.Fog
    const distance = this.overviewView().position.distanceTo(new THREE.Vector3(0, this.buildingHeight / 2, 0))
    fog.near = distance + 6
    fog.far = distance + 40
    this.controls.maxDistance = distance * 1.6
  }

  private pick(event: PointerEvent): HoverTarget | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)

    // Сначала — квартиры раскрытого этажа
    if (this.selected !== null) {
      const open = this.floors[this.selected]
      if (open && open.open > 0.5) {
        const hit = this.raycaster.intersectObjects(open.rooms.map((r) => r.tile), false)[0]
        if (hit) return { floor: open.index, room: hit.object.userData.roomIndex as number }
      }
    }

    const pickable = this.floors
      .filter((f) => this.isVisible(f) && f.growth > 0.5 && f.index !== this.selected)
      .map((f) => f.body)
    const hit = this.raycaster.intersectObjects(pickable, false)[0]
    return hit ? { floor: hit.object.userData.floorIndex as number, room: null } : null
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private onPointerUp = (event: PointerEvent) => {
    const start = this.pointerDown
    this.pointerDown = null
    if (!start || event.button !== 0) return
    // Отличаем клик от перетаскивания камеры
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_TOLERANCE_PX) return
    const target = this.pick(event)
    if (!target) return
    if (target.room !== null) this.callbacks.onSelectRoom?.(target.floor, target.room)
    else this.callbacks.onSelectFloor?.(target.floor)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || this.pointerDown) return
    const target = this.pick(event)
    this.hoveredRoom = target?.room ?? null
    this.renderer.domElement.style.cursor = target ? "pointer" : "grab"
    this.callbacks.onHover?.(target, event.clientX, event.clientY)
  }

  private onPointerLeave = (event: PointerEvent) => {
    this.hoveredRoom = null
    this.callbacks.onHover?.(null, event.clientX, event.clientY)
  }

  // ───────────────────────── Анимация ─────────────────────────

  private isVisible(floor: FloorVisual) {
    return this.filter === "all" || floor.status === this.filter
  }

  private tick = (now: number) => {
    this.frameId = requestAnimationFrame(this.tick)
    const dt = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now
    const colorK = 1 - Math.exp(-8 * dt)

    if (this.flight) {
      const k = 1 - Math.exp(-4 * dt)
      this.controls.target.lerp(this.flight.target, k)
      this.camera.position.lerp(this.flight.position, k)
      if (
        this.camera.position.distanceTo(this.flight.position) < 0.02 &&
        this.controls.target.distanceTo(this.flight.target) < 0.02
      ) {
        this.flight = null
      }
    }

    const hasSelection = this.selected !== null
    for (const floor of this.floors) {
      const visible = this.isVisible(floor)
      const isSelected = floor.index === this.selected
      const isHovered = floor.index === this.hovered
      const isAbove = hasSelection && floor.index > this.selected!

      let targetOpacity = 1
      if (!visible) targetOpacity = 0.07
      else if (isAbove) targetOpacity = 0.18
      else if (hasSelection && !isSelected) targetOpacity = 0.55

      const targetEmissive = !visible ? 0 : isSelected ? 0.25 : isHovered ? 0.3 : 0
      const targetScale = isHovered && visible && !isSelected ? 1.02 : 1

      floor.open = damp(floor.open, isSelected ? 1 : 0, 8, dt)
      floor.opacity = damp(floor.opacity, targetOpacity, 10, dt)
      floor.emissive = damp(floor.emissive, targetEmissive, 12, dt)
      floor.scale = damp(floor.scale, targetScale, 12, dt)
      floor.lift = damp(floor.lift, isAbove ? LIFT : 0, 6, dt)
      floor.growth = damp(floor.growth, floor.status === "planned" ? 0 : 1, 6, dt)

      // У раскрытого этажа внешние стены становятся «стеклянными», а потолок исчезает
      const bodyOpacity = THREE.MathUtils.lerp(floor.opacity, 0.08, floor.open)
      const material = floor.body.material
      material.color.lerp(floor.targetColor, colorK)
      material.emissive.copy(material.color)
      material.opacity = bodyOpacity
      material.depthWrite = bodyOpacity > 0.95
      material.emissiveIntensity = floor.emissive
      floor.body.castShadow = visible && floor.open < 0.5

      floor.slab.material.opacity = Math.min(floor.opacity, 1 - floor.open)
      floor.slab.material.depthWrite = floor.slab.material.opacity > 0.95
      floor.slab.visible = floor.slab.material.opacity > 0.02

      floor.group.visible = floor.growth > 0.01
      floor.group.scale.set(floor.scale, Math.max(floor.growth, 0.001), floor.scale)
      floor.group.position.y = BASE_Y + floor.index * FLOOR_STEP + floor.lift

      floor.edges.material.opacity = isSelected ? 0.7 : visible ? 0.25 * floor.opacity : 0.06
      floor.label.material.opacity = (visible ? Math.max(floor.opacity, 0.6) : 0.15) * floor.growth

      floor.interior.visible = floor.open > 0.01
      if (floor.interior.visible) this.animateRooms(floor, isSelected, dt, colorK)
    }

    if (this.crane && !this.reducedMotion) {
      this.crane.rotation.y = 0.6 + Math.sin(now / 6000) * 0.5
    }

    this.controls.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private animateRooms(floor: FloorVisual, isSelected: boolean, dt: number, colorK: number) {
    const open = floor.open
    for (const room of floor.rooms) {
      const target = !isSelected ? 0 : room.index === this.selectedRoom ? 1 : room.index === this.hoveredRoom ? 0.5 : 0
      room.highlight = damp(room.highlight, target, 14, dt)

      const material = room.tile.material
      material.color.lerp(room.targetColor, colorK)
      material.emissive.copy(material.color)
      material.emissiveIntensity = 0.15 + room.highlight * 0.6
      material.opacity = open * (this.selectedRoom === null || room.highlight > 0.5 ? 1 : 0.6)
      room.tile.scale.y = 1 + room.highlight * 3
      room.tile.position.y = 0.04 + room.highlight * 0.05

      room.walls.material.opacity = open * (0.35 + room.highlight * 0.5)
      room.label.material.opacity = open
    }
    const corridor = floor.interior.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
    corridor.material.opacity = open
  }
}
