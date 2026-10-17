import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { sceneRobots, type SceneDefinition, type SceneRobot } from '../scene/types'
import { DEG_TO_RAD, yawQuaternion } from './geometry'
import type { BodyTransform } from './physics'
import { buildRobotModel, type RobotModel } from './robots/models'
import { INK_MAX_POINTS, TRAIL_MAX_POINTS, type Ink, type SimulationFrame, type Trail } from './simulation'

const BORDER_HEIGHT = 0.08
const BORDER_THICKNESS = 0.04
/**
 * Robots' paths (a faint guide that can be hidden) and their pen's ink (part of the drawing, always
 * shown), as flat strips on the floor: width and height above it, in metres. Ink lies over paths,
 * and both over the scene's lines.
 */
const TRAIL = { width: 0.004, y: 0.0025, opacity: 0.45 }
const INK = { width: 0.008, y: 0.003 }

/** Flat strips on the floor, rebuilt into a fixed buffer when what they show changes. */
interface StripMesh {
  mesh: THREE.Mesh
  positions: Float32Array
  /** Per-vertex colours, for ink; paths are one colour. */
  colors: Float32Array | null
  width: number
  y: number
  /** What was last drawn, so an unchanged path or ink is skipped and a new run's is redrawn. */
  drawn: Trail | Ink | null
  drawnVersion: number
}

interface Run {
  points: { x: number; z: number }[]
  color?: THREE.Color
}

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
  private readonly robots = new Map<string, RobotModel>()
  private readonly trails = new Map<string, StripMesh>()
  private readonly inks = new Map<string, StripMesh>()
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
    for (const robot of sceneRobots(definition)) {
      const model = this.buildRobot(robot)
      this.robots.set(robot.id, model)
      this.scene.add(model.object)
      this.trails.set(robot.id, this.buildStrips(TRAIL_MAX_POINTS, TRAIL.width, TRAIL.y, 1, model.color))
      this.inks.set(robot.id, this.buildStrips(INK_MAX_POINTS, INK.width, INK.y, 2, null))
    }

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  /** Moves bodies to a simulation frame. */
  update(frame: SimulationFrame): void {
    for (const [id, state] of frame.robots) {
      const model = this.robots.get(id)
      if (!model) continue
      applyTransform(model.object, state.transform)
      model.update(state)
    }
    for (const [id, trail] of frame.trails) {
      const mesh = this.trails.get(id)
      if (mesh) drawStrips(mesh, trail, () => trail.segments.map((points) => ({ points })))
    }
    for (const [id, ink] of frame.ink) {
      const mesh = this.inks.get(id)
      if (mesh) drawStrips(mesh, ink, () => ink.strokes.map(({ color, points }) => ({ points, color: new THREE.Color(color) })))
    }
    for (const [id, transform] of frame.props) {
      const object = this.props.get(id)
      if (object) applyTransform(object, transform)
    }
  }

  render(): void {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  /** Shows or hides the robots' drawn paths. */
  setTrailsVisible(visible: boolean): void {
    for (const trail of this.trails.values()) trail.mesh.visible = visible
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

  /**
   * A mesh for up to `maxPoints` points of strips, drawn after the floor, zones and scene lines
   * (`order`) so it lies on top of them. With no colour, its strips carry their own.
   */
  private buildStrips(maxPoints: number, width: number, y: number, order: number, color: string | null): StripMesh {
    // Two triangles per pair of points, as separate vertices.
    const positions = new Float32Array(maxPoints * 6 * 3)
    const colors = color ? null : new Float32Array(maxPoints * 6 * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setDrawRange(0, 0)
    const material = color
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: TRAIL.opacity, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = order
    mesh.frustumCulled = false
    this.scene.add(mesh)
    return { mesh, positions, colors, width, y, drawn: null, drawnVersion: -1 }
  }

  private buildRobot(robot: SceneRobot): RobotModel {
    const model = buildRobotModel(robot.type, { color: robot.color })
    const start = robot.start
    model.object.position.set(start.x, model.restHeight, start.z)
    model.object.quaternion.copy(toQuaternion(yawQuaternion(start.headingDeg * DEG_TO_RAD)))
    return model
  }
}

function drawStrips(target: StripMesh, source: Trail | Ink, runs: () => Run[]): void {
  if (target.drawn === source && target.drawnVersion === source.version) return
  target.drawn = source
  target.drawnVersion = source.version
  const { positions, colors, y } = target
  const half = target.width / 2
  let v = 0
  let color: THREE.Color | undefined
  const put = (x: number, z: number) => {
    if (colors && color) {
      colors[v] = color.r
      colors[v + 1] = color.g
      colors[v + 2] = color.b
    }
    positions[v++] = x
    positions[v++] = y
    positions[v++] = z
  }
  for (const run of runs()) {
    color = run.color
    const { points } = run
    // A single point is a dot: a square the strip's width.
    const pairs = points.length === 1 ? [[points[0]!, { x: points[0]!.x + 1e-6, z: points[0]!.z }]] : points.slice(1).map((b, i) => [points[i]!, b])
    for (const [a, b] of pairs as [Run['points'][number], Run['points'][number]][]) {
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      if (length === 0) continue
      // Along and across the piece; stretched by half the width at each end so corners join up.
      const ux = (b.x - a.x) / length
      const uz = (b.z - a.z) / length
      const ax = a.x - ux * half
      const az = a.z - uz * half
      const bx = b.x + ux * half
      const bz = b.z + uz * half
      const nx = -uz * half
      const nz = ux * half
      if (v + 18 > positions.length) break
      put(ax + nx, az + nz)
      put(ax - nx, az - nz)
      put(bx + nx, bz + nz)
      put(bx + nx, bz + nz)
      put(ax - nx, az - nz)
      put(bx - nx, bz - nz)
    }
  }
  const geometry = target.mesh.geometry
  geometry.setDrawRange(0, v / 3)
  for (const name of colors ? ['position', 'color'] : ['position']) {
    const attribute = geometry.getAttribute(name) as THREE.BufferAttribute
    attribute.clearUpdateRanges()
    attribute.addUpdateRange(0, v)
    attribute.needsUpdate = true
  }
}

function toQuaternion(q: { x: number; y: number; z: number; w: number }): THREE.Quaternion {
  return new THREE.Quaternion(q.x, q.y, q.z, q.w)
}

function applyTransform(object: THREE.Object3D, transform: BodyTransform): void {
  object.position.set(transform.position.x, transform.position.y, transform.position.z)
  object.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w)
}
