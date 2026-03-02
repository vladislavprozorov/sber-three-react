import { useRef, useEffect } from "react"
import * as THREE from "three"
export default function ThreeScene(){
    const containerRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!containerRef.current) return;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        containerRef.current.appendChild(renderer.domElement);
        camera.position.z = 5;
        const box = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({color: "green"});
        const mesh = new THREE.Mesh(box, material);
        scene.add(mesh);
        const light = new THREE.AmbientLight("white", 1);
        light.position.set(5, 5, 5);
        scene.add(light);
        renderer.render(scene, camera);
        function animate(){
            requestAnimationFrame(animate);
            mesh.rotation.x += 0.01;
            mesh.rotation.y += 0.01;
            renderer.render(scene, camera);
        }
        animate();
    }, [])    
    return (
        <div style={{width: "100%", height: "100vh"}} ref={containerRef}></div>
    )
}