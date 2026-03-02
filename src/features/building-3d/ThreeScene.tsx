import { useRef, useEffect } from "react"
import * as THREE from "three"

type Props = {
    onFloorSelect?: (floorIndex: number) => void
}
export default function ThreeScene({ onFloorSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#1e1e1e")

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight || 1, 0.1, 1000)
    camera.position.set(5, 5, 10)
    camera.lookAt(0, 4, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth || container.offsetWidth, container.clientHeight || container.offsetHeight)
    container.appendChild(renderer.domElement)

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(container)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(10, 10, 10)
    scene.add(directionalLight)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const geometry = new THREE.BoxGeometry(4, 2, 4)

    const floors: THREE.Mesh[] = []

    for (let i = 0; i < 5; i++) {
      const floorMaterial = new THREE.MeshStandardMaterial({ color: "green" })
      const floor = new THREE.Mesh(geometry, floorMaterial)

      floor.position.y = i * 2
      floor.userData.floorIndex = i

      floors.push(floor)
      scene.add(floor)
    }

    function onClick(event: MouseEvent) {
      if (!containerRef.current) return

      const rect = renderer.domElement.getBoundingClientRect()

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      const intersects = raycaster.intersectObjects(floors)

      if (intersects.length > 0) {
        const selected = intersects[0].object as THREE.Mesh

        floors.forEach((floor) => {
          ;(floor.material as THREE.MeshStandardMaterial).color.set("green")
        })

        ;(selected.material as THREE.MeshStandardMaterial).color.set("red")

        if (onFloorSelect) {
          onFloorSelect(selected.userData.floorIndex)
        }
      }
    }

    renderer.domElement.addEventListener("click", onClick)

    function animate() {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      renderer.domElement.removeEventListener("click", onClick)
      resizeObserver.disconnect()
      renderer.dispose()
      scene.clear()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
    />
  )
}