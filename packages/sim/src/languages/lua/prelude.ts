import { PEN_COLORS } from '../../robots/pen'
import type { RobotApi } from '../../robots/types'

/**
 * Lua that runs before a learner's program: the `robot` table (for the robot's API family) and
 * `print`, in the same units as the blocks (centimetres, degrees, seconds, % speed), and the
 * removal of libraries a simulation program has no use for.
 *
 * The host functions (`_sim_command`, `_sim_sensor`, `_sim_tick`) return JavaScript promises.
 * Calling `:await()` on one suspends the whole program, through Lua coroutines, until the host
 * answers once the action has finished in simulated time - from any depth of function calls, so
 * learners write ordinary Lua.
 */
export function luaPrelude(robots: { id: string; api: RobotApi }[]): string {
  // Robot ids are validated identifiers, so they can go straight into the code.
  const entries = robots.map(({ id, api }) => `${id} = ${api === 'arm' ? 'arm' : 'wheeled'}("${id}")`).join(', ')
  return `${HELPERS}${PEN}${FACTORIES}
robots = { ${entries} }
robot = robots.${robots[0]?.id ?? 'robot'}
function wait_for_all() idle(""):await() end
${RUNTIME}`
}

const HELPERS = String.raw`
local command, sensor, idle, host_tick, host_print = _sim_command, _sim_sensor, _sim_idle, _sim_tick, _sim_print

local function speed_or(value)
  if value == nil then return 50 end
  return value
end

local function cm(id, name)
  return math.floor(sensor(id, name):await() * 1000 + 0.5) / 10
end

-- Every robot has its commands, the same commands under "start" without waiting for them to
-- finish, and wait_until_done().
local function with_start(id, commands)
  local robot = commands(true)
  robot.start = commands(false)
  robot.wait_until_done = function() idle(id):await() end
  return robot
end
`

const PEN = `
local pen_colors = { ${PEN_COLORS.map((color) => `"${color.name}"`).join(', ')} }

local function add_pen(api, run)
  api.pen_down = function() run("penDown") end
  api.pen_up = function() run("penUp") end
  api.pen_color = function(color)
    local name = string.lower(tostring(color))
    for index, known in ipairs(pen_colors) do
      if known == name then return run("penColor", index - 1) end
    end
    error("There is no pen colour '" .. tostring(color) .. "'. Try " .. table.concat(pen_colors, ", ") .. ".", 2)
  end
  return api
end
`

const FACTORIES = String.raw`
local function wheeled(id)
  local robot = with_start(id, function(wait)
    local function run(name, ...) command(id, wait, name, ...):await() end
    local api = {
      move = function(distance, speed) run("move", distance, speed_or(speed)) end,
      turn_left = function(degrees, speed) run("turn", degrees, speed_or(speed)) end,
      turn_right = function(degrees, speed) run("turn", -degrees, speed_or(speed)) end,
      drive = function(speed, seconds) run("drive", speed_or(speed), seconds and seconds * 1000 or 0) end,
      set_wheels = function(left, right) run("setWheels", left, right) end,
      stop = function() run("stop") end,
    }
    if wait then api.wait = function(seconds) run("wait", seconds * 1000) end end
    return add_pen(api, run)
  end)
  robot.front_distance = function() return cm(id, "distance_front") end
  robot.line_left = function() return sensor(id, "line_left"):await() == true end
  robot.line_right = function() return sensor(id, "line_right"):await() == true end
  robot.x = function() return cm(id, "pos_x") end
  robot.z = function() return cm(id, "pos_z") end
  robot.heading = function() return sensor(id, "heading"):await() end
  return robot
end

local function arm(id)
  local robot = with_start(id, function(wait)
    local function run(name, ...) command(id, wait, name, ...):await() end
    local api = {
      set_base = function(degrees, speed) run("setBase", degrees, speed_or(speed)) end,
      set_shoulder = function(degrees, speed) run("setShoulder", degrees, speed_or(speed)) end,
      set_elbow = function(degrees, speed) run("setElbow", degrees, speed_or(speed)) end,
      set_wrist = function(degrees, speed) run("setWrist", degrees, speed_or(speed)) end,
      reach = function(distance, height, speed) run("reach", distance, height, speed_or(speed)) end,
      open_gripper = function() run("openGripper") end,
      close_gripper = function() run("closeGripper") end,
      stop = function() run("stop") end,
    }
    if wait then api.wait = function(seconds) run("wait", seconds * 1000) end end
    return add_pen(api, run)
  end)
  robot.base_angle = function() return sensor(id, "base_angle"):await() end
  robot.shoulder_angle = function() return sensor(id, "shoulder_angle"):await() end
  robot.elbow_angle = function() return sensor(id, "elbow_angle"):await() end
  robot.wrist_angle = function() return sensor(id, "wrist_angle"):await() end
  robot.holding = function() return sensor(id, "holding"):await() == true end
  robot.gripper_distance = function() return cm(id, "gripper_distance") end
  robot.gripper_x = function() return cm(id, "gripper_x") end
  robot.gripper_z = function() return cm(id, "gripper_z") end
  robot.gripper_height = function() return cm(id, "gripper_height") end
  return robot
end
`

const RUNTIME = String.raw`
function print(...)
  local parts = {}
  for i = 1, select("#", ...) do
    parts[#parts + 1] = tostring((select(i, ...)))
  end
  host_print(table.concat(parts, "\t"))
end

function _sim_tick() host_tick():await() end

-- Nothing in a simulation program needs files, the operating system or native modules.
io = nil
os = { time = os.time, clock = os.clock, date = os.date, difftime = os.difftime }
package = nil
require = nil
dofile = nil
loadfile = nil
debug = nil
_sim_command, _sim_sensor, _sim_idle, _sim_print = nil, nil, nil, nil
`
