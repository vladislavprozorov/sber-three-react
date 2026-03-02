import { useRef, useEffect } from "react"
import * as THREE from "three"
export default function ThreeScene(){
    const containerRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#1e1e1e");


        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(5, 5, 10);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(width, height);
        containerRef.current.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight("white", 1);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight("white", 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        const geometry = new THREE.BoxGeometry(4, 2, 4);
        const material = new THREE.MeshStandardMaterial({color: "green"});
        
        for(let i = 0; i < 5; i++){
            const floor = new THREE.Mesh(geometry, material);
            floor.position.y = i * 2;
            scene.add(floor);
        }
      
        function animate(){
            requestAnimationFrame(animate);
            renderer.render(scene, camera); 
        }
        animate();

        return () => {
            renderer.dispose();
            scene.clear();
            containerRef.current?.removeChild(renderer.domElement);
        }
    }, [])    
    return (
        <div style={{width: "100%", height: "100vh"}} ref={containerRef}></div>
    )
}