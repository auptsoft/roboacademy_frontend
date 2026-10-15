import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getCapability } from '../robots'
import type { SceneDefinition } from '../scene/types'
import { DEG_TO_RAD, yawQuaternion } from './geometry'
import type { BodyTransform } from './physics'
import type { SimulationFrame } from './simulation'

const BORDER_HEIGHT = 0.08
const BORDER_THICKNESS = 0.04

/**
 * Draws a scene with three.js. Purely a view: it reads simulation frames and never touches
 * physics. `dispose` releases the WebGL context, which matters on low-spec devices where a
 * leaked context is what eventually breaks the page.
 */
export class ArenaRenderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly robot: THREE.Group
  private readonly props = new Map<string, THREE.Object3D>()
  private readonly resizeObserver: ResizeObserver
  private readonly container: HTMLElement
  private readonly definition: SceneDefinition

  constructor(container: HTMLElement, definition: SceneDefinition, options: { background?: string } = {}) {
    this.container = container
    this.definition = definition
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.style.display = 'block'
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(options.background ?? '#dfe5ec')

    const { width, depth } = definition.arena
    const span = Math.max(width, depth)
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, span * 10)
    this.camera.position.set(0, span * 0.9, span * 0.75)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0, 0)
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05
    this.controls.minDistance = 0.3
    this.controls.maxDistance = span * 4

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(span, span * 2, span)
    this.scene.add(sun)

    this.buildArena()
    this.robot = this.buildRobot()
    this.scene.add(this.robot)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  /** Moves bodies to a simulation frame. */
  update(frame: SimulationFrame): void {
    applyTransform(this.robot, frame.robot)
    for (const [id, transform] of frame.props) {
      const object = this.props.get(id)
      if (object) applyTransform(object, transform)
    }
  }

  render(): void {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  /** Returns the camera to its starting view. */
  resetView(): void {
    const span = Math.max(this.definition.arena.width, this.definition.arena.depth)
    this.camera.position.set(0, span * 0.9, span * 0.75)
    this.controls.target.set(0, 0, 0)
  }

  dispose(): void {
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) material.dispose()
      }
    })
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(width, height, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private buildArena(): void {
    const { width, depth, floorColor } = this.definition.arena

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.95 }),
    )
    floor.rotation.x = -Math.PI / 2
    this.scene.add(floor)

    const grid = new THREE.GridHelper(Math.max(width, depth), Math.round(Math.max(width, depth) * 10), 0x9aa7b4, 0xc6ced6)
    grid.position.y = 0.0005
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.35
    grid.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth))
    this.scene.add(grid)

    const borderMaterial = new THREE.MeshStandardMaterial({ color: '#5b6b7b' })
    const borders: [number, number, number, number][] = [
      [0, -depth / 2 - BORDER_THICKNESS / 2, width + BORDER_THICKNESS * 2, BORDER_THICKNESS],
      [0, depth / 2 + BORDER_THICKNESS / 2, width + BORDER_THICKNESS * 2, BORDER_THICKNESS],
      [-width / 2 - BORDER_THICKNESS / 2, 0, BORDER_THICKNESS, depth],
      [width / 2 + BORDER_THICKNESS / 2, 0, BORDER_THICKNESS, depth],
    ]
    for (const [x, z, sx, sz] of borders) {
      const border = new THREE.Mesh(new THREE.BoxGeometry(sx, BORDER_HEIGHT, sz), borderMaterial.clone())
      border.position.set(x, BORDER_HEIGHT / 2, z)
      this.scene.add(border)
    }
    borderMaterial.dispose()

    for (const zone of this.definition.zones) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(zone.size.x, zone.size.z),
        new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.45, depthWrite: false }),
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(zone.center.x, 0.001, zone.center.z)
      this.scene.add(mesh)
    }

    for (const line of this.definition.lines) {
      const material = new THREE.MeshBasicMaterial({ color: line.color })
      for (let i = 0; i < line.points.length - 1; i++) {
        const a = line.points[i]!
        const b = line.points[i + 1]!
        const length = Math.hypot(b.x - a.x, b.z - a.z)
        if (length === 0) continue
        // Overlap segments by the line width so corners have no gaps.
        const segment = new THREE.Mesh(new THREE.PlaneGeometry(length + line.width, line.width), material.clone())
        segment.rotation.x = -Math.PI / 2
        segment.rotation.z = -Math.atan2(b.z - a.z, b.x - a.x)
        segment.position.set((a.x + b.x) / 2, 0.0015, (a.z + b.z) / 2)
        this.scene.add(segment)
      }
      material.dispose()
    }

    for (const wall of this.definition.walls) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(wall.length, wall.height, wall.thickness),
        new THREE.MeshStandardMaterial({ color: '#8795a3', roughness: 0.8 }),
      )
      mesh.position.set(wall.x, wall.height / 2, wall.z)
      mesh.quaternion.copy(toQuaternion(yawQuaternion(wall.rotationDeg * DEG_TO_RAD)))
      this.scene.add(mesh)
    }

    for (const prop of this.definition.props) {
      const geometry =
        prop.shape === 'box'
          ? new THREE.BoxGeometry(prop.size.x, prop.size.y, prop.size.z)
          : prop.shape === 'sphere'
            ? new THREE.SphereGeometry(prop.size.x, 24, 16)
            : new THREE.CylinderGeometry(prop.size.x, prop.size.x, prop.size.y, 24)
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.6 }))
      const halfHeight = prop.shape === 'sphere' ? prop.size.x : prop.size.y / 2
      mesh.position.set(prop.x, halfHeight, prop.z)
      this.props.set(prop.id, mesh)
      this.scene.add(mesh)
    }
  }

  private buildRobot(): THREE.Group {
    const capability = getCapability(this.definition.robot.type)
    const size = capability?.size ?? { width: 0.18, length: 0.2, height: 0.1 }
    const group = new THREE.Group()

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(size.length, size.height * 0.7, size.width * 0.8),
      new THREE.MeshStandardMaterial({ color: '#2f6fec', roughness: 0.5 }),
    )
    body.position.y = size.height * 0.05
    group.add(body)

    const wheelRadius = size.height / 2
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius, wheelRadius, size.width * 0.1, 20),
        new THREE.MeshStandardMaterial({ color: '#1d232a', roughness: 0.9 }),
      )
      wheel.rotation.x = Math.PI / 2
      wheel.position.set(-size.length * 0.1, 0, (side * size.width) / 2 - side * size.width * 0.05)
      group.add(wheel)
    }

    // A pointer on top, so the heading is readable from any camera angle.
    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(size.width * 0.18, size.length * 0.35, 3),
      new THREE.MeshStandardMaterial({ color: '#ffd23f' }),
    )
    pointer.rotation.z = -Math.PI / 2
    pointer.position.set(size.length * 0.2, size.height * 0.45, 0)
    group.add(pointer)

    const start = this.definition.robot.start
    group.position.set(start.x, size.height / 2, start.z)
    group.quaternion.copy(toQuaternion(yawQuaternion(start.headingDeg * DEG_TO_RAD)))
    return group
  }
}

function toQuaternion(q: { x: number; y: number; z: number; w: number }): THREE.Quaternion {
  return new THREE.Quaternion(q.x, q.y, q.z, q.w)
}

function applyTransform(object: THREE.Object3D, transform: BodyTransform): void {
  object.position.set(transform.position.x, transform.position.y, transform.position.z)
  object.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w)
}
