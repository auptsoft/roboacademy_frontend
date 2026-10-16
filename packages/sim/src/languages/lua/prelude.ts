/**
 * Lua that runs before a learner's program: the `robot` table and `print`, in the same units as
 * the blocks (centimetres, seconds, % speed), and the removal of libraries a simulation program
 * has no use for.
 *
 * The host functions (`_sim_command`, `_sim_sensor`, `_sim_tick`) return JavaScript promises.
 * Calling `:await()` on one suspends the whole program, through Lua coroutines, until the host
 * answers once the action has finished in simulated time - from any depth of function calls, so
 * learners write ordinary Lua.
 */
export const LUA_PRELUDE = String.raw`
local command, sensor, host_tick, host_print = _sim_command, _sim_sensor, _sim_tick, _sim_print

local function speed_or(value)
  if value == nil then return 50 end
  return value
end

local function cm(name)
  return math.floor(sensor(name):await() * 1000 + 0.5) / 10
end

robot = {
  move = function(distance, speed) command("move", distance, speed_or(speed)):await() end,
  turn_left = function(degrees, speed) command("turn", degrees, speed_or(speed)):await() end,
  turn_right = function(degrees, speed) command("turn", -degrees, speed_or(speed)):await() end,
  drive = function(speed, seconds)
    command("drive", speed_or(speed), seconds and seconds * 1000 or 0):await()
  end,
  set_wheels = function(left, right) command("setWheels", left, right):await() end,
  stop = function() command("stop"):await() end,
  wait = function(seconds) command("wait", seconds * 1000):await() end,
  front_distance = function() return cm("distance_front") end,
  line_left = function() return sensor("line_left"):await() == true end,
  line_right = function() return sensor("line_right"):await() == true end,
  x = function() return cm("pos_x") end,
  z = function() return cm("pos_z") end,
  heading = function() return sensor("heading"):await() end,
}

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
_sim_command, _sim_sensor, _sim_print = nil, nil, nil
`
