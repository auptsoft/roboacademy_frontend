/**
 * A robot type's capability file: everything the blocks toolbox, the program runtime and the
 * scene editor need to know about a robot, in one place. Adding a robot type means adding one of
 * these, a driver and a model (engine/robots/), not changing the engine or the runtime.
 */

export interface NumberParam {
  name: string
  label: string
  unit?: string
  min: number
  max: number
  default: number
}

export interface CommandSpec {
  name: string
  label: string
  params: NumberParam[]
}

export type SensorKind = 'number' | 'boolean'

export interface SensorSpec {
  name: string
  label: string
  kind: SensorKind
  unit?: string
  /** Pose sensors can be hidden per scene when a lesson shouldn't allow dead reckoning. */
  hideable?: boolean
}

export interface JointSpec {
  name: string
  label: string
  /** Degrees. */
  min: number
  max: number
  /** Where the joint starts each run, in degrees. */
  rest: number
}

/**
 * The programming interface a robot type speaks: which `robot` object the text languages define
 * and which blocks the toolbox offers. Robot types that share one differ only in the simulator.
 */
export type RobotApi = 'wheeled' | 'arm'

export interface RobotCapability {
  /** Stable key stored on scenes, e.g. `diff-drive`. */
  type: string
  label: string
  api: RobotApi
  commands: CommandSpec[]
  sensors: SensorSpec[]
  /** Physical footprint in metres, used by physics and the scene editor. */
  size: { width: number; length: number; height: number }
  /** Joints objectives can check with `jointAtAngle`. */
  joints?: JointSpec[]
  /** Whether it can pick props up, so objectives can check `propHeldBy`. */
  gripper?: boolean
}

export function findCommand(capability: RobotCapability, name: string): CommandSpec | undefined {
  return capability.commands.find((command) => command.name === name)
}

export function findSensor(capability: RobotCapability, name: string): SensorSpec | undefined {
  return capability.sensors.find((sensor) => sensor.name === name)
}

/**
 * Validates and clamps a command's arguments against its spec. The program runs in a worker and
 * its messages are untrusted input, so nothing reaches the engine without passing through here.
 */
export function normaliseCommandArgs(
  spec: CommandSpec,
  args: Record<string, unknown>,
): Record<string, number> | null {
  const result: Record<string, number> = {}
  for (const param of spec.params) {
    const raw = args[param.name]
    const value = raw === undefined ? param.default : Number(raw)
    if (!Number.isFinite(value)) return null
    result[param.name] = Math.min(param.max, Math.max(param.min, value))
  }
  return result
}
