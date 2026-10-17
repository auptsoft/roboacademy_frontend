import { arm } from './arm'
import { diffDrive } from './diff-drive'
import { rover } from './rover'
import type { RobotCapability } from './types'

export * from './types'
export { PEN_COLORS } from './pen'
export { arm } from './arm'
export { diffDrive } from './diff-drive'
export { rover } from './rover'

const registry: Record<string, RobotCapability> = {
  [diffDrive.type]: diffDrive,
  [rover.type]: rover,
  [arm.type]: arm,
}

export function getCapability(type: string): RobotCapability | undefined {
  return registry[type]
}

export function listCapabilities(): RobotCapability[] {
  return Object.values(registry)
}
