import { useRef, useEffect } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { mockFloors, STATUS_COLORS } from "../building-info/floorService"

type Props = {
  onFloorSelect?: (floorIndex: number) => void
}

export default function ThreeScene({ onFloorSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#1e1e1e")

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight || 1,
      0.1,
      1000,
    )
    camera.position.set(5, 5, 10)
    camera.lookAt(0, 4, 0)

    const cameraTargetPos = new THREE.Vector3(5, 5, 10)
    const cameraLookAt = new THREE.Vector3(0, 4, 0)
    let isAnimatingCamera = false

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(
      container.clientWidth || container.offsetWidth,
      container.clientHeight || container.offsetHeight,
    )
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 5
    controls.maxDistance = 30
    controls.target.set(0, 4, 0)
    controls.update()

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(container)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(10, 10, 10)
    scene.add(dirLight)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const FLOOR_HEIGHT = 1.7
    const FLOOR_STEP = 2.0
    const floorGeometry = new THREE.BoxGeometry(4, FLOOR_HEIGHT, 4)

    const slabGeometry = new THREE.BoxGeometry(4.3, 0.25, 4.3)
    const slabMaterial = new THREE.MeshStandardMaterial({ color: "#555560" })

    const floors: THREE.Mesh[] = []
    let selectedIndex: number | null = null
    let hoveredMesh: THREE.Mesh | null = null

    for (let i = 0; i < mockFloors.length; i++) {
      const data = mockFloors[i]
      const mat = new THREE.MeshStandardMaterial({ color: STATUS_COLORS[data.status] })
      const floor = new THREE.Mesh(floorGeometry, mat)
      floor.position.y = i * FLOOR_STEP + FLOOR_HEIGHT / 2
      floor.userData.floorIndex = i
      floors.push(floor)
      scene.add(floor)

      const slab = new THREE.Mesh(slabGeometry, slabMaterial)
      slab.position.y = i * FLOOR_STEP + FLOOR_HEIGHT + 0.125
      scene.add(slab)
    }

    function refreshColors() {
      floors.forEach((floor) => {
        const idx = floor.userData.floorIndex as number
        const base = STATUS_COLORS[mockFloors[idx].status]
        let targetColor: THREE.ColorRepresentation = base

        if (idx === selectedIndex) {
          targetColor = "#ffffff"
        } else if (floor === hoveredMesh) {
          const c = new THREE.Color(base)
          c.lerp(new THREE.Color("#ffffff"), 0.3)
          targetColor = c
        }
        ;(floor.material as THREE.MeshStandardMaterial).color.set(targetColor)
      })
    }

    function moveCameraToFloor(floorY: number) {
      cameraTargetPos.set(7, floorY + 3, 12)
      cameraLookAt.set(0, floorY + 0.5, 0)
      isAnimatingCamera = true
      controls.target.set(0, floorY + 0.5, 0)
    }

    function onClick(event: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      const hits = raycaster.intersectObjects(floors)
      if (hits.length > 0) {
        const mesh = hits[0].object as THREE.Mesh
        selectedIndex = mesh.userData.floorIndex as number
        refreshColors()
        moveCameraToFloor(mesh.position.y)
        onFloorSelect?.(selectedIndex)
      }
    }

    function onMouseMove(event: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      const hits = raycaster.intersectObjects(floors)
      const tooltip = tooltipRef.current

      if (hits.length > 0) {
        const mesh = hits[0].object as THREE.Mesh
        if (hoveredMesh !== mesh) {
          hoveredMesh = mesh
          refreshColors()
        }
        if (tooltip) {
          const idx = mesh.userData.floorIndex as number
          const data = mockFloors[idx]
          const statusLabel = data.status === "ready" ? "Готов" : data.status === "building" ? "Строится" : "Проблема"
          tooltip.textContent = `${data.label} — ${statusLabel}`
          tooltip.style.left = `${event.clientX - rect.left + 14}px`
          tooltip.style.top = `${event.clientY - rect.top - 32}px`
          tooltip.style.opacity = "1"
        }
        container.style.cursor = "pointer"
      } else {
        if (hoveredMesh) {
          hoveredMesh = null
          refreshColors()
        }
        if (tooltip) tooltip.style.opacity = "0"
        container.style.cursor = "default"
      }
    }

    renderer.domElement.addEventListener("click", onClick)
    renderer.domElement.addEventListener("mousemove", onMouseMove)

    function animate() {
      requestAnimationFrame(animate)

      if (isAnimatingCamera) {
        camera.position.lerp(cameraTargetPos, 0.06)
        const currentLook = new THREE.Vector3()
        camera.getWorldDirection(currentLook)
        currentLook.multiplyScalar(10).add(camera.position)
        currentLook.lerp(cameraLookAt, 0.06)
        camera.lookAt(currentLook)

        if (camera.position.distanceTo(cameraTargetPos) < 0.05) {
          isAnimatingCamera = false
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      renderer.domElement.removeEventListener("click", onClick)
      renderer.domElement.removeEventListener("mousemove", onMouseMove)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      scene.clear()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 0.15s",
          background: "rgba(0,0,0,0.78)",
          color: "#fff",
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 13,
          whiteSpace: "nowrap",
          zIndex: 10,
        }}
      />
    </div>
  )
}