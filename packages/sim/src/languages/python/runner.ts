/**
 * Python that runs inside Pyodide before a learner's program: the `robot` object, `print`, and
 * the rewrite that lets ordinary-looking Python wait for the robot.
 *
 * Robot commands have to pause the program until the robot finishes, in simulated time, which
 * happens on the main thread. Rather than blocking the worker (that would need cross-origin
 * isolation headers), the learner's code is rewritten before it runs:
 * - every call becomes `await _sim_maybe(call)`, which awaits it only if it returned something
 *   awaitable, so robot calls and the learner's own functions wait, and everything else is
 *   untouched;
 * - the learner's functions that use the robot (directly, or through their other functions)
 *   become `async def` so those awaits are allowed inside them; every other function stays as it
 *   is, so it can still be passed to built-ins like `sorted(key=...)`;
 * - each statement is preceded by `_sim_line(n)`, for running-line highlighting and error locations;
 * - each loop body starts with `await _sim_tick()`, so loops advance simulated time.
 * Line numbers are kept, so errors point at the learner's own lines.
 *
 * The helpers use single-underscore `_sim_` names: Python mangles double-underscore names inside
 * class bodies, which would break them in a learner's methods.
 */
export const PYTHON_RUNNER = String.raw`
import ast
import builtins
import inspect
import json
import types


class ProgramError(Exception):
    def __init__(self, message, line=None):
        super().__init__(message)
        self.line = line


_BLOCKED_MODULES = ("js", "pyodide", "pyodide_js", "_pyodide", "micropip")


async def _sim_maybe(value):
    if inspect.isawaitable(value):
        return await value
    return value


def _contains_yield(node):
    for child in ast.walk(node):
        if child is not node and isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            continue
        if isinstance(child, (ast.Yield, ast.YieldFrom)):
            return True
    return False


def _can_be_async(node):
    # Dunder methods are called by Python itself (an async __init__ is an error), decorated
    # functions may be wrapped by something that doesn't expect a coroutine, and a function
    # with yield is a generator.
    name = node.name
    return not (name.startswith("__") and name.endswith("__")) and not node.decorator_list and not _contains_yield(node)


def _root_name(node):
    while isinstance(node, ast.Attribute):
        node = node.value
    return node.id if isinstance(node, ast.Name) else None


def _robot_calls(node):
    # Names of the learner's functions called in this function, and whether it calls a robot:
    # robot.move(), robot.start.move(), robots.rover.move(), wait_for_all().
    names, robot = set(), False
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        func = child.func
        if isinstance(func, ast.Attribute) and _root_name(func) in ("robot", "robots"):
            robot = True
        elif isinstance(func, ast.Name):
            if func.id == "wait_for_all":
                robot = True
            names.add(func.id)
        elif isinstance(func, ast.Attribute):
            names.add(func.attr)
    return names, robot


def _functions_needing_async(tree):
    # A function needs to be async if it calls the robot, or calls a function that does. Matched
    # by name (methods by attribute name), which can over-include but never misses a robot call.
    calls = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and _can_be_async(node):
            names, robot = _robot_calls(node)
            previous = calls.get(node.name, (set(), False))
            calls[node.name] = (previous[0] | names, previous[1] or robot)
    needs = {name for name, (_, robot) in calls.items() if robot}
    changed = True
    while changed:
        changed = False
        for name, (names, _) in calls.items():
            if name not in needs and names & needs:
                needs.add(name)
                changed = True
    return needs


def _call(name, *args):
    return ast.Call(func=ast.Name(id=name, ctx=ast.Load()), args=list(args), keywords=[])


class _Instrument(ast.NodeTransformer):
    def __init__(self, needs_async):
        # Whether awaiting is allowed where we are: at the top level (with top-level await) and
        # in functions we made async; not in other functions, lambdas or class bodies.
        self._async = [True]
        self._needs_async = needs_async

    def _with(self, allowed, node):
        self._async.append(allowed)
        try:
            return self.generic_visit(node)
        finally:
            self._async.pop()

    def visit_FunctionDef(self, node):
        if node.name not in self._needs_async or not _can_be_async(node):
            return self._with(False, node)
        node = self._with(True, node)
        fields = {field: getattr(node, field) for field in node._fields}
        return ast.copy_location(ast.AsyncFunctionDef(**fields), node)

    def visit_AsyncFunctionDef(self, node):
        return self._with(True, node)

    def visit_Lambda(self, node):
        return self._with(False, node)

    def visit_ClassDef(self, node):
        # A class body runs synchronously: awaiting directly in it isn't allowed.
        return self._with(False, node)

    def visit_Call(self, node):
        node = self.generic_visit(node)
        if not self._async[-1]:
            return node
        return ast.copy_location(ast.Await(value=_call("_sim_maybe", node)), node)

    def visit_Import(self, node):
        for alias in node.names:
            self._check_module(alias.name, node)
        return node

    def visit_ImportFrom(self, node):
        self._check_module(node.module or "", node)
        return node

    def _check_module(self, name, node):
        if name.split(".")[0] in _BLOCKED_MODULES:
            raise ProgramError(f"Line {node.lineno}: the module '{name}' isn't available in the simulator.", node.lineno)

    def generic_visit(self, node):
        super().generic_visit(node)
        for field in ("body", "orelse", "finalbody"):
            statements = getattr(node, field, None)
            if not isinstance(statements, list) or not statements or not isinstance(statements[0], ast.stmt):
                continue
            instrumented = []
            for statement in statements:
                marker = ast.Expr(value=_call("_sim_line", ast.Constant(value=statement.lineno)))
                instrumented.append(ast.copy_location(marker, statement))
                instrumented.append(statement)
            if field == "body" and isinstance(node, (ast.For, ast.While)) and self._async[-1]:
                tick = ast.Expr(value=ast.Await(value=_call("_sim_tick")))
                instrumented.insert(0, ast.copy_location(tick, statements[0]))
            setattr(node, field, instrumented)
        return node


_PEN_COLORS = json.loads(_sim_pen_colors)


class _RobotBase:
    """One robot, by id. start gives its commands without waiting for them to finish."""

    def __init__(self, robot_id, wait=True):
        self._id = robot_id
        self._wait = wait

    @property
    def start(self):
        return type(self)(self._id, False)

    async def _command(self, name, args=None):
        await _sim_host("command", name, json.dumps(args or {}), self._id, self._wait)

    async def _sensor(self, name):
        return await _sim_host("sensor", name, "{}", self._id, True)

    async def _cm(self, sensor):
        return round(await self._sensor(sensor) * 100, 1)

    async def stop(self):
        await self._command("stop")

    async def wait(self, seconds):
        # Waiting is the program's own; there's nothing to start.
        await _sim_host("command", "wait", json.dumps({"ms": seconds * 1000}), self._id, True)

    async def wait_until_done(self):
        await _sim_host("idle", "", "{}", self._id, True)

    async def pen_down(self):
        await self._command("penDown")

    async def pen_up(self):
        await self._command("penUp")

    async def pen_color(self, color):
        name = str(color).lower()
        if name not in _PEN_COLORS:
            raise ValueError(f"There is no pen colour '{color}'. Try {', '.join(_PEN_COLORS)}.")
        await self._command("penColor", {"color": _PEN_COLORS.index(name)})


class _WheeledRobot(_RobotBase):
    """A wheeled robot, in the same units as the blocks: centimetres, seconds and % speed."""

    async def move(self, distance, speed=50):
        await self._command("move", {"distanceCm": distance, "speed": speed})

    async def turn_left(self, degrees, speed=50):
        await self._command("turn", {"degrees": degrees, "speed": speed})

    async def turn_right(self, degrees, speed=50):
        await self._command("turn", {"degrees": -degrees, "speed": speed})

    async def drive(self, speed=50, seconds=None):
        duration = 0 if seconds is None else seconds * 1000
        await self._command("drive", {"speed": speed, "durationMs": duration})

    async def set_wheels(self, left, right):
        await self._command("setWheels", {"left": left, "right": right})

    async def front_distance(self):
        return await self._cm("distance_front")

    async def line_left(self):
        return bool(await self._sensor("line_left"))

    async def line_right(self):
        return bool(await self._sensor("line_right"))

    async def x(self):
        return await self._cm("pos_x")

    async def z(self):
        return await self._cm("pos_z")

    async def heading(self):
        return await self._sensor("heading")


class _ArmRobot(_RobotBase):
    """The robot arm, in the same units as the blocks: centimetres, degrees, seconds and % speed."""

    async def set_base(self, degrees, speed=50):
        await self._command("setBase", {"degrees": degrees, "speed": speed})

    async def set_shoulder(self, degrees, speed=50):
        await self._command("setShoulder", {"degrees": degrees, "speed": speed})

    async def set_elbow(self, degrees, speed=50):
        await self._command("setElbow", {"degrees": degrees, "speed": speed})

    async def set_wrist(self, degrees, speed=50):
        await self._command("setWrist", {"degrees": degrees, "speed": speed})

    async def reach(self, distance, height, speed=50):
        await self._command("reach", {"distanceCm": distance, "heightCm": height, "speed": speed})

    async def open_gripper(self):
        await self._command("openGripper")

    async def close_gripper(self):
        await self._command("closeGripper")

    async def base_angle(self):
        return await self._sensor("base_angle")

    async def shoulder_angle(self):
        return await self._sensor("shoulder_angle")

    async def elbow_angle(self):
        return await self._sensor("elbow_angle")

    async def wrist_angle(self):
        return await self._sensor("wrist_angle")

    async def holding(self):
        return bool(await self._sensor("holding"))

    async def gripper_distance(self):
        return await self._cm("gripper_distance")

    async def gripper_x(self):
        return await self._cm("gripper_x")

    async def gripper_z(self):
        return await self._cm("gripper_z")

    async def gripper_height(self):
        return await self._cm("gripper_height")


async def _wait_for_all():
    await _sim_host("idle", "", "{}", None, True)


_ROBOTS = {"wheeled": _WheeledRobot, "arm": _ArmRobot}


def _print(*values, sep=" ", end="\n", **_):
    _sim_print(sep.join(str(value) for value in values))


async def run_program(source, robots_json):
    try:
        tree = ast.parse(source, "<program>")
    except SyntaxError as error:
        raise ProgramError(f"Line {error.lineno}: {error.msg}", error.lineno) from None
    tree = _Instrument(_functions_needing_async(tree)).visit(tree)
    ast.fix_missing_locations(tree)
    try:
        code = compile(tree, "<program>", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    except SyntaxError as error:
        raise ProgramError(f"Line {error.lineno}: {error.msg}", error.lineno) from None

    robots = {r["id"]: _ROBOTS.get(r["api"], _WheeledRobot)(r["id"]) for r in json.loads(robots_json)}
    program_builtins = dict(vars(builtins))
    program_builtins["print"] = _print
    scope = {
        "__name__": "__main__",
        "__builtins__": program_builtins,
        "robot": next(iter(robots.values())),
        "robots": types.SimpleNamespace(**robots),
        "wait_for_all": _wait_for_all,
        "_sim_maybe": _sim_maybe,
        "_sim_line": _sim_line,
        "_sim_tick": _sim_tick,
    }
    result = eval(code, scope)
    if inspect.isawaitable(result):
        await result
`
