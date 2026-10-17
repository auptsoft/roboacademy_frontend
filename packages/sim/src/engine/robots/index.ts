import { armDriver } from './arm'
import { diffDriveDriver, roverDriver } from './wheeled'
import type { RobotDriver } from './types'

export * from './types'

const drivers: Record<string, RobotDriver> = {
  [diffDriveDriver.type]: diffDriveDriver,
  [roverDriver.type]: roverDriver,
  [armDriver.type]: armDriver,
}

export function getRobotDriver(type: string): RobotDriver | undefined {
  return drivers[type]
}
