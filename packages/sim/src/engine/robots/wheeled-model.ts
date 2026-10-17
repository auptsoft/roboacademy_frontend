import * as THREE from 'three'
import { diffDrive } from '../../robots/diff-drive'
import { rover } from '../../robots/rover'
import type { RobotCapability } from '../../robots'
import type { RobotLook, RobotModel } from './models'

interface WheeledLook {
  bodyColor: string
  /** Wheel positions along the body, as fractions of its length from the centre (+ is the front). */
  axles: number[]
}

/** A blue box on two wheels, with a yellow pointer on top showing which way it faces. */
export const buildDiffDriveModel = (look: RobotLook): RobotModel =>
  buildWheeledModel(diffDrive, { bodyColor: look.color ?? '#2f6fec', axles: [-0.1] })

/** The same, bigger, orange and on four wheels. */
export const buildRoverModel = (look: RobotLook): RobotModel =>
  buildWheeledModel(rover, { bodyColor: look.color ?? '#e8742a', axles: [-0.3, 0.3] })

function buildWheeledModel(capability: RobotCapability, look: WheeledLook): RobotModel {
  const size = capability.size
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size.length, size.height * 0.7, size.width * 0.8),
    new THREE.MeshStandardMaterial({ color: look.bodyColor, roughness: 0.5 }),
  )
  body.position.y = size.height * 0.05
  group.add(body)

  const wheelRadius = size.height / 2
  for (const axle of look.axles) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius, wheelRadius, size.width * 0.1, 20),
        new THREE.MeshStandardMaterial({ color: '#1d232a', roughness: 0.9 }),
      )
      wheel.rotation.x = Math.PI / 2
      wheel.position.set(size.length * axle, 0, (side * size.width) / 2 - side * size.width * 0.05)
      group.add(wheel)
    }
  }

  // A pointer on top, so the heading is readable from any camera angle.
  const pointer = new THREE.Mesh(
    new THREE.ConeGeometry(size.width * 0.18, size.length * 0.35, 3),
    new THREE.MeshStandardMaterial({ color: '#ffd23f' }),
  )
  pointer.rotation.z = -Math.PI / 2
  pointer.position.set(size.length * 0.2, size.height * 0.45, 0)
  group.add(pointer)

  return {
    object: group,
    restHeight: size.height / 2,
    color: look.bodyColor,
    update: () => {},
  }
}
