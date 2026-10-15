import { diffDrive } from './diff-drive'
import type { RobotCapability } from './types'

export * from './types'
export { diffDrive } from './diff-drive'

const registry: Record<string, RobotCapability> = {
  [diffDrive.type]: diffDrive,
}

export function getCapability(type: string): RobotCapability | undefined {
  return registry[type]
}

export function listCapabilities(): RobotCapability[] {
  return Object.values(registry)
}
