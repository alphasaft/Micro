import { AST, MacroAST } from "./ast"
import { MapLike } from "./_util"
import { Metadata, summarize } from "./metadata"

/** 
 * A usable, processed JS value. This type alias is used to contrast ASTs (which must yet be evaluated), and
 * values, who are the result of such an evaluation.
 */
export type Value = any


/** A bundle of reducers, including both operator and macro reducers. */
export type ReducersPackage = {
    operators?: MapLike<OpReducer>,
    macros?: MapLike<MacroReducer>,
}


/** 
 * A function that is able to evaluate an AST to a usable JS value, using the ambient reducers.
 * If `postMap` is provided, it is ran on the value and its result returned.
 * Should an error happen while evaluating `ast` (including within `postMap`), it will gain
 * context to reflect the fact the error is syntactically located within `ast`.
 */
export type Evaluator = (ast: AST, postMap?: (x: Value) => Value) => Value

/**
 * A macro semantic context. Bundles an `Evaluator` provider, `use`, and the ambiantly defined macros and operators.
 */
export type Context = {
    use: (pkg: ReducersPackage) => Evaluator
    operators: MapLike<OpReducer>
    macros: MapLike<MacroReducer>
}

/** Implements a macro by reducing the AST to produce a usuable JS value. */
export type MacroReducer = (ctx: Context, ast: MacroAST) => Value;


/** Implements an operator by joining several ASTs together. */
export type OpReducer = ($: Evaluator, ...operands: AST[]) => Value;

/** Lifts literals to usable JS values. */
export type Lifter = (literal: string) => Value;

/** Handles an error, optionally rethrowing it. */
export type ErrorHandler = (error: any) => Value;

/** Implements a plain operator reducer, i.e that evaluates once its arguments and reduces them using `f`. */
export const plain = (f: (...args: Value) => Value): OpReducer => ($, ...args) => f(...args.map(arg => $(arg)))

/** Implements a Plain Left-Associative (operator) Reducer. `plar(f)` is `($, ...args) => args.map($).reduce(f)`. */
export const plar = (f: (a: Value, b: Value) => Value): OpReducer => ($, ...args) => args.map(arg => $(arg)).reduce(f);

/** Implements a Plain Right-Associative (operator) Reducer. `prar(f)` is `($, ...args) => args.map($).reduceRight((x,y) => f(y,x))`. */
export const prar = (f: (a: Value, b: Value) => Value): OpReducer => ($, ...args) => args.map(arg => $(arg)).reduceRight((prev,curr) => f(curr,prev));


/** 
 * Runs the block. If any error happens inside it, it is wrapped as a `ReducerError`, 
 * then `info` is added as context as of during which process the error happened. 
 */
export function contextualize<T>(info: string | Metadata, block: () => T): T {
    try {
        return block()
    } catch (e) {
        let wrapped = ReducerError.wrap(e)
        wrapped.contextualize(typeof info === "string" ? `While ${info}` : summarize(info))
        throw wrapped
    }
}

/** Returns a function that calls `contextualize` onto `block` with `info` when called. */
export function contextualizedFunc<T, Args extends any[]>(info: string | Metadata, block: (...args: Args) => T): (...args: Args) => T {
    return (...args) => contextualize(info, () => block(...args))
}

/** Throws msg wrapped inside a `ReducerError` (eventually contextualizing it with `info` beforehand). */
export function error(msg: string, info?: string | Metadata): never {
    let err = ReducerError.wrap(msg)
    if (info !== undefined) err = contextualize(info, () => err)
    throw err
}

/** Returns the wrapped error if `e` is a `ReducerError` wrapper, else `e` itself. */
export function unwrapError<E>(e: E): Unwrapped<E> {
    return e instanceof ReducerError ? e.unwrap() : e as Unwrapped<E>
}

export type Unwrapped<Error> = Error extends ReducerError<infer Inner> ? Inner : Error

export type { ReducerError }
class ReducerError<Error> {
    private constructor(private err: Error, private stack: string[]) {}

    static wrap<Error>(err: Error): ReducerError<Unwrapped<Error>> {
        return err instanceof ReducerError ? err : new ReducerError(err as Unwrapped<Error>, []) 
    }

    unwrap() {
        return this.err
    }

    toString() {
        return `${this.stack.join(' :\n')} :\n${this.err}`
    }

    contextualize(...info: string[]): this {
        this.stack.unshift(...info)
        return this
    }
}




/** An abstract class able to run through ASTs to reduce them. */
export abstract class MicroReducer {

    /** The function that will be used to lift `LiteralAST`s to a usable `Value`. */
    protected abstract lift: Lifter

    /** The function to which the whole script AST will be passed for reducing (i.e the MicroReducer's entry point) */
    protected abstract script: MacroReducer

    /** The function that will handle errors, should one happen. */
    protected handle: ErrorHandler = (e: any) => { if (e instanceof ReducerError) throw e.toString(); else throw e }

    /** The operator reducer that will be used to reduce some operator if no reducer is provided. If not overriden, throws an exception. */
    protected defaultOpReducer: OpReducer = () => { error("Syntax error.") }

    /** The macro reducer that will be used to reduce some macro if no reducer is provided. If not overriden, throws an exception. */
    protected defaultMacroReducer: MacroReducer = () => { error("Syntax error.") }

    private reduce_(
        ast: AST, 
        context: Context,
        postMap: (x: Value) => Value
    ): Value {
        return contextualize(ast.metadata, () => {
            switch (ast.type) {
                case "literal":
                    return postMap(this.lift(ast.value))

                case "operation":
                    let { op: name1, operands } = ast
                    let operator = context.operators[name1] ?? this.defaultOpReducer
                    return postMap(operator(context.use({}), ...operands))

                case "macro":
                    let { name: name2 } = ast
                    let macro = context.macros[name2] ?? this.defaultMacroReducer
                    return postMap(macro(context, ast))
            }  
        })
    }

    private makeContext(
        ambientOperators: MapLike<OpReducer>, 
        ambientMacros: MapLike<MacroReducer>
    ): Context {
        let self = this

        function use(pkg: ReducersPackage): Evaluator {
            return (ast, postMap = x => x) => {
                let operators = pkg.operators ? { ...ambientOperators, ...pkg.operators } : ambientOperators
                let macros = pkg.macros ? { ...ambientMacros, ...pkg.macros } : ambientMacros
                let context = self.makeContext(operators, macros)
                return self.reduce_(ast, context, postMap)
            }
        }

        return {
            use: use,
            operators: ambientOperators,
            macros: ambientMacros
        }
    }

    /** Applies the script reducer to `ast` and returns the result. */
    reduce(ast: MacroAST): Value {
        try {
            return this.script(this.makeContext({}, {}), ast)
        } catch (e) {
            return this.handle(e)
        }
    }
}

