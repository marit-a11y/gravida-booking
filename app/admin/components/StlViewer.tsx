'use client'

import { useEffect, useRef } from 'react'

interface StlViewerProps {
  url: string
  height?: number
  className?: string
}

/**
 * 3D viewer voor STL bestanden. Laadt three.js + STLLoader dynamisch zodat
 * de bundle van de admin pagina niet onnodig groeit voor mensen die nooit
 * een STL openen.
 */
export default function StlViewer({ url, height = 360, className = '' }: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const container = containerRef.current
      if (!container) return

      const THREE = await import('three')
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

      if (cancelled) return

      // Scene
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xf5f1eb) // gravida-cream-achtig

      const width = container.clientWidth
      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000)
      camera.position.set(0, 0, 300)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(width, height)
      container.innerHTML = ''
      container.appendChild(renderer.domElement)

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambient)
      const dir1 = new THREE.DirectionalLight(0xffffff, 0.8)
      dir1.position.set(1, 1, 1).normalize()
      scene.add(dir1)
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.4)
      dir2.position.set(-1, -1, -1).normalize()
      scene.add(dir2)

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true

      // Load STL
      const loader = new STLLoader()
      let mesh: THREE.Mesh | null = null
      loader.load(url, (geometry) => {
        if (cancelled) return
        geometry.computeBoundingBox()
        geometry.computeVertexNormals()
        const material = new THREE.MeshPhongMaterial({
          color: 0xc8b8a5, // beige-roze, neutraal voor buikje
          specular: 0x111111,
          shininess: 60,
        })
        mesh = new THREE.Mesh(geometry, material)
        // Center + schaal naar zicht
        if (geometry.boundingBox) {
          const center = geometry.boundingBox.getCenter(new THREE.Vector3())
          mesh.position.sub(center)
          const size = geometry.boundingBox.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 150 / maxDim
          mesh.scale.setScalar(scale)
        }
        scene.add(mesh)
      }, undefined, (err) => {
        console.error('STL load error:', err)
      })

      let frameId = 0
      const animate = () => {
        controls.update()
        renderer.render(scene, camera)
        frameId = requestAnimationFrame(animate)
      }
      animate()

      const handleResize = () => {
        const w = container.clientWidth
        camera.aspect = w / height
        camera.updateProjectionMatrix()
        renderer.setSize(w, height)
      }
      window.addEventListener('resize', handleResize)

      cleanupRef.current = () => {
        window.removeEventListener('resize', handleResize)
        cancelAnimationFrame(frameId)
        controls.dispose()
        renderer.dispose()
        if (mesh) {
          mesh.geometry.dispose()
          if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose())
          else mesh.material.dispose()
        }
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
    init()
    return () => {
      cancelled = true
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [url, height])

  return (
    <div ref={containerRef} className={`relative rounded-xl overflow-hidden border border-gravida-cream bg-gravida-cream/40 ${className}`} style={{ height }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p className="text-xs text-gravida-light-sage">3D model laden...</p>
      </div>
    </div>
  )
}
