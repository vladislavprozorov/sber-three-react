import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { FLOORS, STATUS_COLORS, type FloorStatus } from "../building-info/floorService"

export type FilterValue = FloorStatus | "all"

export interface BuildingSceneCallbacks {
  /** Клик по этажу (null — клик мимо здания). */
  onSelect?: (floorIndex: number) => void
  /** Курсор над этажом; вызывается на каждое движение, чтобы двигать тултип. */
  onHover?: (floorIndex: number | null, clientX: number, clientY: number) => void
}

const FLOOR_W = 5
const FLOOR_D = 4
const FLOOR_H = 0.95
const FLOOR_STEP = 1.15
const SLAB_H = 0.12
const BUILDING_H = FLOORS.length * FLOOR_STEP
const BG_COLOR = "#0d0f14"
const FOV = 42
const CLICK_TOLERANCE_PX = 6

interface FloorVisual {
  index: number
  status: FloorStatus
  group: THREE.Group
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>
  label: THREE.Sprite
  // текущие анимируемые значения
  emissive: number
  opacity: number
  scale: number
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

function createLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "rgba(15, 18, 25, 0.85)"
  ctx.beginPath()
  ctx.arc(64, 64, 56, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.25)"
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.fillStyle = "#ffffff"
  ctx.font = "600 60px Inter, system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, 64, 68)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(0.55, 0.55, 1)
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
  private crane: THREE.Group | null = null

  private callbacks: BuildingSceneCallbacks
  private selected: number | null = null
  private hovered: number | null = null
  private filter: FilterValue = "all"

  private flight: { target: THREE.Vector3; position: THREE.Vector3 } | null = null
  private pointerDown: { x: number; y: number } | null = null
  private frameId = 0
  private lastTime = performance.now()

  constructor(container: HTMLElement, callbacks: BuildingSceneCallbacks = {}) {
    this.container = container
    this.callbacks = callbacks
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

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
    this.buildFloors()
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

  setSelected(index: number | null) {
    if (index === this.selected) return
    this.selected = index
    this.controls.autoRotate = false
    this.flight = index === null ? this.overviewView() : this.floorView(index)
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

  private buildFloors() {
    const bodyGeometry = new THREE.BoxGeometry(FLOOR_W, FLOOR_H, FLOOR_D)
    const edgesGeometry = new THREE.EdgesGeometry(bodyGeometry)
    const slabGeometry = new THREE.BoxGeometry(FLOOR_W + 0.3, SLAB_H, FLOOR_D + 0.3)
    const slabMaterial = new THREE.MeshStandardMaterial({ color: "#6b7280", roughness: 0.8 })
    const windowTexture = createWindowTexture()
    const baseY = 0.2

    for (const floor of FLOORS) {
      const color = new THREE.Color(STATUS_COLORS[floor.status])
      const group = new THREE.Group()
      group.position.y = baseY + floor.floorIndex * FLOOR_STEP

      const body = new THREE.Mesh(
        bodyGeometry,
        new THREE.MeshStandardMaterial({
          color,
          map: windowTexture,
          emissive: color,
          emissiveIntensity: 0,
          roughness: 0.45,
          metalness: 0.1,
          transparent: true,
        }),
      )
      body.position.y = FLOOR_H / 2
      body.castShadow = true
      body.receiveShadow = true
      body.userData.floorIndex = floor.floorIndex
      group.add(body)

      const edges = new THREE.LineSegments(
        edgesGeometry,
        new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.25 }),
      )
      edges.position.y = FLOOR_H / 2
      group.add(edges)

      const slab = new THREE.Mesh(slabGeometry, slabMaterial)
      slab.position.y = FLOOR_H + SLAB_H / 2
      slab.castShadow = true
      slab.receiveShadow = true
      group.add(slab)

      const label = createLabelSprite(String(floor.floorIndex + 1))
      label.position.set(-FLOOR_W / 2 - 0.55, FLOOR_H / 2, FLOOR_D / 2)
      group.add(label)

      this.scene.add(group)
      this.floors.push({
        index: floor.floorIndex,
        status: floor.status,
        group,
        body,
        edges,
        label,
        emissive: 0,
        opacity: 1,
        scale: 1,
      })
    }
  }

  private buildCrane() {
    const steel = new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.6, metalness: 0.3 })
    const dark = new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.8 })
    const height = BUILDING_H + 2.5
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
    const target = new THREE.Vector3(0, BUILDING_H / 2, 0)
    // В портретном кадре кран можно обрезать, иначе здание станет слишком мелким
    const width = this.camera.aspect < 1 ? FLOOR_W + 2 : FLOOR_W + 9
    const distance = this.fitDistance(width, BUILDING_H + 4) + FLOOR_D / 2
    const position = target.clone().addScaledVector(this.viewDirection(0.35), distance)
    return { target, position }
  }

  private floorView(index: number) {
    const y = 0.2 + index * FLOOR_STEP + FLOOR_H / 2
    const target = new THREE.Vector3(0, y, 0)
    const distance = this.fitDistance(FLOOR_W + 2, FLOOR_STEP * 3.5) + FLOOR_D / 2
    const position = target.clone().addScaledVector(this.viewDirection(0.45), distance)
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
    const distance = this.overviewView().position.distanceTo(new THREE.Vector3(0, BUILDING_H / 2, 0))
    fog.near = distance + 6
    fog.far = distance + 40
    this.controls.maxDistance = distance * 1.6
  }

  private pick(event: PointerEvent): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const pickable = this.floors.filter((f) => this.isVisible(f)).map((f) => f.body)
    const hit = this.raycaster.intersectObjects(pickable, false)[0]
    return hit ? (hit.object.userData.floorIndex as number) : null
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
    const index = this.pick(event)
    if (index !== null) this.callbacks.onSelect?.(index)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || this.pointerDown) return
    const index = this.pick(event)
    this.renderer.domElement.style.cursor = index === null ? "grab" : "pointer"
    this.callbacks.onHover?.(index, event.clientX, event.clientY)
  }

  private onPointerLeave = (event: PointerEvent) => {
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

      let targetOpacity = 1
      if (!visible) targetOpacity = 0.07
      else if (hasSelection && !isSelected) targetOpacity = 0.55

      const targetEmissive = !visible ? 0 : isSelected ? 0.55 : isHovered ? 0.3 : 0
      const targetScale = isSelected ? 1.06 : isHovered && visible ? 1.02 : 1

      floor.opacity = damp(floor.opacity, targetOpacity, 10, dt)
      floor.emissive = damp(floor.emissive, targetEmissive, 12, dt)
      floor.scale = damp(floor.scale, targetScale, 12, dt)

      const material = floor.body.material
      material.opacity = floor.opacity
      material.depthWrite = floor.opacity > 0.95
      material.emissiveIntensity = floor.emissive
      floor.body.castShadow = visible
      floor.group.scale.set(floor.scale, 1, floor.scale)

      floor.edges.material.opacity = isSelected ? 0.9 : visible ? 0.25 : 0.06
      floor.label.material.opacity = visible ? Math.max(floor.opacity, 0.6) : 0.15
    }

    if (this.crane && !this.reducedMotion) {
      this.crane.rotation.y = 0.6 + Math.sin(now / 6000) * 0.5
    }

    this.controls.update(dt)
    this.renderer.render(this.scene, this.camera)
  }
}
