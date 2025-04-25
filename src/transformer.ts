import { AST, MacroAST } from "./ast"
import { Metadata, throwWith } from "./metadata"
import { Dictionary } from "./_util"


/**
 * A semantic context, i.e the set of macro and operator reducers ambiantly defined along with the according evaluator function.
 * @see Evaluator
 */
export type Context<T> = {
    $: Evaluator<T>
    operators: Dictionary<OpReducer<T>>
    macros: Dictionary<MacroReducer<T>>
}

/** 
 * The core function used when writing reducers, usually denoted as `$`. `$(ast)` reduces `ast` to a plain JS value, 
 * hence effectively evaluating it, using the ambient and/or provided operator and macro reducers. 
 * 
 * Said reducers can be passed as the second and third argument to `$` respectively : `$(ast, opReducers, macroReducers)` will attempt
 * to reduce `ast` by applying it `opReducers` and `macroReducers`.
 */
export type Evaluator<T> = (
    ast: AST,
    operators?: Dictionary<OpReducer<T>>,
    macros?: Dictionary<MacroReducer<T>>
) => T

/** A plain Javascript function meant to reduce an AST representing a macro to a usuable value of type T. */
export type MacroReducer<T> = (ev: Context<T>, ast: MacroAST) => T;

/** A plain Javascript function meant to implement an operator by reducing several JS values together. */
export type OpReducer<T> = (args: T[], name: string, metadata: Metadata) => T;

/** Implements a Left-Associative (operator) Reducer. `lar(f)` is `args => args.reduce(f)` */
export const lar = <T>(f: (a: T, b: T) => T): OpReducer<T> => (args) => args.reduce(f);

/** Implements a Right-Associative (operator) Reducer. `lar(f)` is `args => args.reduceRight(f)` */
export const rar = <T>(f: (a: T, b: T) => T): OpReducer<T> => (args) => args.reduceRight(f);



/** 
 * An abstract class able to run through ASTs to reduce them.
 * Override it to implement your own transformer.
 */
export abstract class MicroTransformer<T> {
    /** A function lifting ASTs representing literals to a JS value. */
    protected abstract lift: (literal: string, metadata: Metadata) => T

    /** The global script reducer. */
    protected abstract reducer: MacroReducer<T>

    /** 
     * The operator reducer that will be used to reduce some `#op` if the `#op` reducer isn't provided. If not overriden, undefined 
     * operator reducers will just throw an exception.  
     */
    protected defaultOpReducer: OpReducer<T> = (_, name, metadata) => throwWith(metadata, `Use of operator '${name}' is not legal here.`)

    /**
     * The operator reducer that will be used to reduce some `macro` if the `macro` reducer isn't provided. If not overriden, undefined 
     * macro reducers will just throw an exception.  
     */
    protected defaultMacroReducer: MacroReducer<T> = (_, { name,metadata }) => throwWith(metadata, `Use of macro '${name}' is not legal here.`)

    private transform_(
        ast: AST, 
        operators: Dictionary<OpReducer<T>>, 
        macros: Dictionary<MacroReducer<T>>,
    ): T {
        switch (ast.type) {

            case "literal":
                return this.lift(ast.value, ast.metadata)

            case "macro":
                let { name: name1, metadata: metadata1 } = ast
                let macro = macros[name1] ?? this.defaultMacroReducer
                return macro(this.makeContext(operators, macros), ast)

            case "operation":
                let { operator: name2, operands, metadata: metadata2 } = ast
                let operator = operators[name2] ?? this.defaultOpReducer
                let evaluatedOperands = operands.map(x => this.transform_(x, operators, macros))
                return operator(evaluatedOperands, name2, metadata2)
        }
    }

    private makeContext(ambientOperators: Dictionary<OpReducer<T>>, ambientMacros: Dictionary<MacroReducer<T>>): Context<T> {
        let self = this
        return {
            $(ast: AST, localOperators: Dictionary<OpReducer<T>> = {}, localMacros: Dictionary<MacroReducer<T>> = {}) {
                let fullOps: Dictionary<OpReducer<T>> = { ...ambientOperators, ...localOperators }
                let fullMacros: Dictionary<MacroReducer<T>> = { ...ambientMacros, ...localMacros }
                return self.transform_(ast, fullOps, fullMacros)
            },
            operators: ambientOperators,
            macros: ambientMacros,
        }
    }

    /** Applies the script reducer to `ast` and returns the result. */
    transform(ast: MacroAST): T {
        return this.reducer(this.makeContext({}, {}), ast)
    }
}
