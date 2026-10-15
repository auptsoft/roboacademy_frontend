declare module 'js-interpreter' {
  /** Minimal typing for Neil Fraser's JS-Interpreter, covering what the program worker uses. */
  export default class Interpreter {
    constructor(code: string, initFunc?: (interpreter: Interpreter, globalObject: object) => void)
    REGEXP_MODE: number
    value: unknown
    /** Runs until the program ends (false) or pauses on an async function (true). */
    run(): boolean
    step(): boolean
    setProperty(object: object, name: string, value: unknown): void
    createNativeFunction(fn: (...args: never[]) => unknown, isConstructor?: boolean): object
    createAsyncFunction(fn: (...args: never[]) => void): object
    nativeToPseudo(value: unknown): unknown
    pseudoToNative(value: unknown): unknown
  }
}
