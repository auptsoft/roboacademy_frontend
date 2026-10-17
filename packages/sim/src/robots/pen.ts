import type { CommandSpec } from './types'

/**
 * Every robot carries a pen that draws on the floor where it touches: midway between a wheeled
 * robot's wheels, or an arm's fingertips when they're down on the floor. The pen starts up.
 * Programs name colours; the robot API passes their index in this palette.
 */
export const PEN_COLORS = [
  { name: 'black', hex: '#1d232a' },
  { name: 'red', hex: '#e5484d' },
  { name: 'orange', hex: '#f76b15' },
  { name: 'yellow', hex: '#ffc53d' },
  { name: 'green', hex: '#30a46c' },
  { name: 'blue', hex: '#0090ff' },
  { name: 'purple', hex: '#8e4ec6' },
  { name: 'white', hex: '#ffffff' },
] as const

export const PEN_COMMANDS: CommandSpec[] = [
  { name: 'penDown', label: 'pen down', params: [] },
  { name: 'penUp', label: 'pen up', params: [] },
  {
    name: 'penColor',
    label: 'pen colour',
    params: [{ name: 'color', label: 'colour', min: 0, max: PEN_COLORS.length - 1, default: 0 }],
  },
]

export const PEN_COMMAND_NAMES = new Set(PEN_COMMANDS.map((command) => command.name))
