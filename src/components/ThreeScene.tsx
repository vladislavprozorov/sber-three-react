import { useRef } from "react"

export default function ThreeScene(){
    const containerRef = useRef<HTMLDivElement | null>(null);
    return (
        <div style={{width: "100%", height: "100vh"}} ref={containerRef}></div>
    )
}