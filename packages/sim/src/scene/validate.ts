import type { ObjectiveSet, Predicate } from '../grading/types'
import { getCapability } from '../robots'
import type { SceneDefinition } from './types'

export interface ValidationIssue {
  path: string
  message: string
}

const MAX_ITEMS = 200

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Checks a scene definition. Returns every problem found, so an editor can show them together. */
export function validateScene(scene: SceneDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (path: string, message: string) => issues.push({ path, message })

  if (scene.version !== 1) add('version', 'Unsupported scene version.')

  const { width, depth } = scene.arena ?? {}
  if (!isFiniteNumber(width) || width < 0.5 || width > 20) add('arena.width', 'Arena width must be 0.5–20 m.')
  if (!isFiniteNumber(depth) || depth < 0.5 || depth > 20) add('arena.depth', 'Arena depth must be 0.5–20 m.')

  const capability = getCapability(scene.robot?.type)
  if (!capability) add('robot.type', `Unknown robot type "${scene.robot?.type}".`)

  const start = scene.robot?.start
  if (!start || !isFiniteNumber(start.x) || !isFiniteNumber(start.z) || !isFiniteNumber(start.headingDeg)) {
    add('robot.start', 'Robot start position is invalid.')
  } else if (isFiniteNumber(width) && isFiniteNumber(depth) && (Math.abs(start.x) > width / 2 || Math.abs(start.z) > depth / 2)) {
    add('robot.start', 'Robot starts outside the arena.')
  }

  const ids = new Set<string>()
  const checkId = (path: string, id: unknown) => {
    if (typeof id !== 'string' || !id.trim()) add(path, 'Missing id.')
    else if (ids.has(id)) add(path, `Duplicate id "${id}".`)
    else ids.add(id)
  }

  const lists = { walls: scene.walls, zones: scene.zones, lines: scene.lines, props: scene.props }
  for (const [name, list] of Object.entries(lists)) {
    if (!Array.isArray(list)) add(name, 'Must be a list.')
    else if (list.length > MAX_ITEMS) add(name, `At most ${MAX_ITEMS} items.`)
  }

  scene.walls?.forEach((wall, i) => {
    checkId(`walls.${i}.id`, wall.id)
    if (!(wall.length > 0 && wall.thickness > 0 && wall.height > 0)) add(`walls.${i}`, 'Wall sizes must be positive.')
  })
  scene.zones?.forEach((zone, i) => {
    checkId(`zones.${i}.id`, zone.id)
    if (!(zone.size?.x > 0 && zone.size?.z > 0)) add(`zones.${i}`, 'Zone size must be positive.')
  })
  scene.lines?.forEach((line, i) => {
    checkId(`lines.${i}.id`, line.id)
    if (!Array.isArray(line.points) || line.points.length < 2) add(`lines.${i}`, 'A line needs at least two points.')
    if (!(line.width > 0)) add(`lines.${i}`, 'Line width must be positive.')
  })
  scene.props?.forEach((prop, i) => {
    checkId(`props.${i}.id`, prop.id)
    if (!['box', 'sphere', 'cylinder'].includes(prop.shape)) add(`props.${i}.shape`, 'Unknown shape.')
    if (!(prop.size?.x > 0) || (prop.shape !== 'sphere' && !(prop.size?.y > 0))) add(`props.${i}`, 'Prop size must be positive.')
    if (!(prop.mass > 0)) add(`props.${i}.mass`, 'Mass must be positive.')
  })

  if (capability) {
    for (const name of scene.hiddenSensors ?? []) {
      const sensor = capability.sensors.find((s) => s.name === name)
      if (!sensor) add('hiddenSensors', `Unknown sensor "${name}".`)
      else if (!sensor.hideable) add('hiddenSensors', `Sensor "${name}" can't be hidden.`)
    }
  }

  if (!isFiniteNumber(scene.timeLimitSec) || scene.timeLimitSec < 5 || scene.timeLimitSec > 600) {
    add('timeLimitSec', 'Time limit must be 5–600 seconds.')
  }

  return issues
}

/** Checks an objective set against the scene it grades: referenced zones and props must exist. */
export function validateObjectives(set: ObjectiveSet, scene: SceneDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (path: string, message: string) => issues.push({ path, message })
  const zoneIds = new Set(scene.zones.map((zone) => zone.id))
  const propIds = new Set(scene.props.map((prop) => prop.id))

  if (set.version !== 1) add('version', 'Unsupported objectives version.')
  if (set.passMark !== undefined && !(set.passMark >= 0 && set.passMark <= 100)) add('passMark', 'Pass mark must be 0–100.')
  if (!Array.isArray(set.objectives)) {
    add('objectives', 'Must be a list.')
    return issues
  }

  const ids = new Set<string>()
  const checkPredicate = (predicate: Predicate, path: string, depth: number): void => {
    if (depth > 8) {
      add(path, 'Objectives are nested too deeply.')
      return
    }
    switch (predicate?.kind) {
      case 'propInZone':
        if (!propIds.has(predicate.propId)) add(path, `Unknown prop "${predicate.propId}".`)
        if (!predicate.zone && !(predicate.zoneId && zoneIds.has(predicate.zoneId))) add(path, 'Pick a zone.')
        break
      case 'robotInZone':
        if (!predicate.zone && !(predicate.zoneId && zoneIds.has(predicate.zoneId))) add(path, 'Pick a zone.')
        break
      case 'robotAtPose':
        if (!(predicate.toleranceM > 0)) add(path, 'Tolerance must be positive.')
        break
      case 'propHeldBy':
      case 'jointAtAngle':
        add(path, `"${predicate.kind}" needs a robot type that this version doesn't support yet.`)
        break
      case 'all':
      case 'any':
      case 'sequence':
        if (!Array.isArray(predicate.of) || predicate.of.length === 0) add(path, 'Add at least one condition.')
        else predicate.of.forEach((child, i) => checkPredicate(child, `${path}.of.${i}`, depth + 1))
        break
      default:
        add(path, 'Unknown condition.')
    }
  }

  set.objectives.forEach((objective, i) => {
    if (!objective.id?.trim()) add(`objectives.${i}.id`, 'Missing id.')
    else if (ids.has(objective.id)) add(`objectives.${i}.id`, `Duplicate id "${objective.id}".`)
    else ids.add(objective.id)
    if (!objective.label?.trim()) add(`objectives.${i}.label`, 'Missing label.')
    if (objective.weight !== undefined && !(objective.weight > 0)) add(`objectives.${i}.weight`, 'Weight must be positive.')
    if (objective.holdMs !== undefined && !(objective.holdMs >= 0)) add(`objectives.${i}.holdMs`, 'Hold time cannot be negative.')
    checkPredicate(objective.predicate, `objectives.${i}.predicate`, 0)
  })

  return issues
}

/** Parses stored JSON. Returns null rather than throwing, so a bad scene can't crash a lesson page. */
export function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw?.trim()) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
