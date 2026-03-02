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
        renderer.render(scene, camera);
    }, [])    
    return (
        <div style={{width: "100%", height: "100vh"}} ref={containerRef}></div>
    )
}