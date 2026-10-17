import { DEFAULT_ROBOT_ID, type ObjectiveSet, type Predicate } from '../grading/types'
import { getCapability } from '../robots'
import { PEN_COLORS } from '../robots/pen'
import { sceneRobots, type SceneDefinition } from './types'

export interface ValidationIssue {
  path: string
  message: string
}

const MAX_ITEMS = 200
const MAX_ROBOTS = 4
const MAX_SHAPE_POINTS = 200

/**
 * Robot ids become names in learners' programs (`robots.rover`), so they must be identifiers in
 * every lesson language, and not one of their keywords.
 */
const ROBOT_ID = /^[a-z][a-z0-9_]{0,19}$/
const RESERVED_IDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'def', 'default',
  'del', 'delete', 'do', 'elif', 'else', 'end', 'except', 'false', 'finally', 'for', 'from', 'function', 'global',
  'goto', 'if', 'import', 'in', 'instanceof', 'is', 'lambda', 'let', 'local', 'new', 'nil', 'none', 'nonlocal', 'not',
  'null', 'or', 'pass', 'raise', 'repeat', 'return', 'self', 'start', 'switch', 'then', 'this', 'throw', 'true', 'try',
  'typeof', 'undefined', 'until', 'var', 'void', 'while', 'with', 'yield',
])

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

  const checkRobot = (path: string, type: unknown, start: SceneDefinition['robot']['start'] | undefined) => {
    if (!getCapability(type as string)) add(`${path}.type`, `Unknown robot type "${type}".`)
    if (!start || !isFiniteNumber(start.x) || !isFiniteNumber(start.z) || !isFiniteNumber(start.headingDeg)) {
      add(`${path}.start`, 'Robot start position is invalid.')
    } else if (isFiniteNumber(width) && isFiniteNumber(depth) && (Math.abs(start.x) > width / 2 || Math.abs(start.z) > depth / 2)) {
      add(`${path}.start`, 'Robot starts outside the arena.')
    }
  }
  checkRobot('robot', scene.robot?.type, scene.robot?.start)

  if (scene.robots !== undefined && !Array.isArray(scene.robots)) add('robots', 'Must be a list.')
  else if ((scene.robots?.length ?? 0) > MAX_ROBOTS - 1) add('robots', `At most ${MAX_ROBOTS} robots in a scene.`)
  const robotIds = new Set([DEFAULT_ROBOT_ID])
  scene.robots?.forEach((robot, i) => {
    if (typeof robot.id !== 'string' || !ROBOT_ID.test(robot.id)) {
      add(`robots.${i}.id`, 'Robot names use lowercase letters, digits and _, starting with a letter.')
    } else if (RESERVED_IDS.has(robot.id)) {
      add(`robots.${i}.id`, `"${robot.id}" can't be a robot name.`)
    } else if (robotIds.has(robot.id)) {
      add(`robots.${i}.id`, `Duplicate robot name "${robot.id}".`)
    }
    robotIds.add(robot.id)
    checkRobot(`robots.${i}`, robot.type, robot.start)
  })

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

  const capabilities = sceneRobots(scene).map((robot) => getCapability(robot.type))
  if (capabilities.every(Boolean)) {
    // Hidden sensors apply to every robot that has them.
    const sensors = capabilities.flatMap((capability) => capability!.sensors)
    for (const name of scene.hiddenSensors ?? []) {
      const matching = sensors.filter((s) => s.name === name)
      if (!matching.length) add('hiddenSensors', `Unknown sensor "${name}".`)
      else if (!matching.every((sensor) => sensor.hideable)) add('hiddenSensors', `Sensor "${name}" can't be hidden.`)
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
  const robots = new Map(sceneRobots(scene).map((robot) => [robot.id, getCapability(robot.type)]))

  if (set.version !== 1) add('version', 'Unsupported objectives version.')
  if (set.passMark !== undefined && !(set.passMark >= 0 && set.passMark <= 100)) add('passMark', 'Pass mark must be 0–100.')
  if (set.par !== undefined) {
    if (set.par.simTimeMs !== undefined && !(set.par.simTimeMs > 0)) add('par.simTimeMs', 'Target time must be more than 0.')
    if (set.par.blocks !== undefined && !(Number.isInteger(set.par.blocks) && set.par.blocks > 0)) {
      add('par.blocks', 'Target blocks must be a whole number above 0.')
    }
  }
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
    const robotId = predicate && 'robotId' in predicate ? predicate.robotId : undefined
    if (robotId !== undefined && !robots.has(robotId)) add(path, `Unknown robot "${robotId}".`)
    const capability = robots.get(robotId ?? DEFAULT_ROBOT_ID)
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
        if (!capability?.gripper) add(path, `The ${capability?.label ?? 'robot'} can't hold props.`)
        else if (!propIds.has(predicate.propId)) add(path, `Unknown prop "${predicate.propId}".`)
        break
      case 'jointAtAngle': {
        const joint = capability?.joints?.find((j) => j.name === predicate.joint)
        if (!capability?.joints?.length) add(path, `The ${capability?.label ?? 'robot'} has no joints.`)
        else if (!joint) add(path, `Unknown joint "${predicate.joint}".`)
        else if (!(predicate.value >= joint.min && predicate.value <= joint.max)) add(path, `The ${joint.label} joint can't reach ${predicate.value}°.`)
        if (!(predicate.toleranceDeg > 0)) add(path, 'Tolerance must be positive.')
        break
      }
      case 'inkMatches': {
        const shape = predicate.shape
        if (!Array.isArray(shape) || shape.length < 2) add(path, 'A shape needs at least two points.')
        else if (shape.length > MAX_SHAPE_POINTS) add(path, `A shape can have at most ${MAX_SHAPE_POINTS} points.`)
        else if (!shape.every((p) => isFiniteNumber(p?.x) && isFiniteNumber(p?.z))) add(path, 'Shape points must be numbers.')
        if (!(predicate.toleranceM > 0 && predicate.toleranceM <= 0.2)) add(path, 'Tolerance must be more than 0 and at most 0.2 m.')
        if (predicate.coverage !== undefined && !(predicate.coverage > 0 && predicate.coverage <= 1)) add(path, 'Coverage must be more than 0 and at most 1.')
        if (predicate.color !== undefined && !PEN_COLORS.some((c) => c.name === predicate.color)) add(path, `Unknown pen colour "${predicate.color}".`)
        break
      }
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
