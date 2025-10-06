import { between, last } from "./_util"
import { AST, OpAST, MacroAST, LiteralAST } from "./ast"
import { OpReducer, MacroReducer, error, Evaluator, Context } from "./reducer"


/** A default implementation to check literal ASTs. Does nothing, as literals do not need to be checked. */
export function checkLiteral(l: string): void {}

/** A default implementation to check operation ASTs. Checks all the operands, and returns. */
export function checkOp($: Evaluator, ...args: AST[]) { args.map(arg => $(arg)) }

/** A default implementation to check macro ASTs. Checks the head, body and limbs in that order, and returns. */
export function checkMacro({use}: Context, { head, body, limbs }: MacroAST) {
    let $ = use({})
    for (let expr of head) $(expr)
    for (let stmt of body) $(stmt)
    for (let limb in limbs) for (let stmt of limbs[limb]!) $(stmt)
}


/** Checks this ast represents an operation, and, if provided, that its type matches op, throws otherwise with msg. */
export function checkIsOp(ast: AST, op?: string, msg: string = "Syntax error."): asserts ast is OpAST {
    if (ast.type !== "operation") error(msg, ast.metadata)
    else if (op !== undefined && ast.op !== op) error(msg, ast.metadata)
}

/** Checks this operation ast matches the provided operator, throws otherwise with msg. */
export function checkOpKind(ast: OpAST, name: string, msg: string = `Expected '${name}'.`): void {
    if (ast.op !== name) error(msg, ast.metadata)
}


/** Checks this operation ast has that many arguments, throws otherwise with msg. Both endpoints inclusive if a range is provided. */
export function checkArity(ast: OpAST, n: number | [number, number], msg?: string) {
    let range: [number, number] = typeof n === "number" ? [n,n] : n 
    if (!between(...range, ast.operands.length)) {
        error(msg ?? `Expected between ${range[0]} and ${range[1]} arguments, got ${ast.operands.length}.`, ast.metadata)
    }
}

/** Checks this ast is a macro ast, throws otherwise with msg. */
export function checkIsMacro(ast: AST, type?: string, msg: string = "Syntax error."): asserts ast is MacroAST {
    if (ast.type !== "macro") error(msg, ast.metadata)
    if (type !== undefined && ast.name !== type) error(msg, ast.metadata)
}

/** Checks this macro ast matches the provided macro name, throws otherwise with msg. */
export function checkMacrokind(ast: AST, name: string, msg: string = `Expected '${name}'.`) {
    assertIsMacro(ast)
    if (ast.name !== name) error(msg, ast.metadata)
}

/** Checks this ast is a literal ast, throws otherwise with msg. */
export function checkIsLiteral(ast: AST, msg: string = "A literal was expected."): asserts ast is LiteralAST {
    if (ast.type !== "literal") error(msg, ast.metadata)
}

/** Checks this ast is a `#name` operator containing a single literal, throws otherwise. */
export function checkIsNamePrimitive(ast: AST): asserts ast is OpAST {
    checkIsOp(ast, "#name")
    checkArity(ast, 1)
    checkIsLiteral(ast.operands[0])
}

/** Checks this ast is a `#number` operator containing a single literal, throws otherwise. */
export function checkIsNumberPrimitive(ast: AST): asserts ast is OpAST {
    checkIsOp(ast, "#number")
    checkArity(ast, 1)
    checkIsLiteral(ast.operands[0])
}

/** Checks this ast is a `#string` operator containing a single literal, throws otherwise. */
export function checkIsStringPrimitive(ast: AST): asserts ast is OpAST {
    checkIsOp(ast, "#string")
    checkArity(ast, 1)
    checkIsLiteral(ast.operands[0])
}


/** Returns whether or not `ast.type === "macro"`. */
export function isMacro(ast: AST, name?: string): ast is MacroAST {
    return ast.type === "macro" && (name === undefined || ast.name === name)
}

/** Returns whether or not `ast.type === "operation"`. */
export function isOp(ast: AST, op?: string): ast is OpAST {
    return ast.type === "operation" && (op === undefined || ast.op === op)
}

/** Returns whether or not `ast.type === "literal"`. */
export function isLiteral(ast: AST): ast is LiteralAST {
    return ast.type === "literal"
}

/** Returns whether or not this ast has the form `[#name 'lit]`. */
export function isNamePrimitive(ast: AST): boolean {
    return isOp(ast, "#name") && ast.operands.length === 1 && isLiteral(ast.operands[0])
}

/** Returns whether or not this ast has the form `[#number 'lit]`. */
export function isNumberPrimitive(ast: AST): boolean {
    return isOp(ast, "#number") && ast.operands.length === 1 && isLiteral(ast.operands[0])
}

/** Returns whether or not this ast has the form `[#string 'lit]`. */
export function isStringPrimitive(ast: AST): boolean {
    return isOp(ast, "#string") && ast.operands.length === 1 && isLiteral(ast.operands[0])
}

/** 
 * Extracts `lit` out of `'lit` as a string.
 * This function assumes `ast` has the correct form. If you're not sure of that, use `checkIsLiteral` before.
 */
export function getLiteral(ast: AST): string {
    assertIsLiteral(ast)
    return ast.value
}

/** 
 * Extracts `lit` out of ```[#name 'lit]``` as a string. 
 * This function assumes `ast` has the correct form. If you're not sure of that, use `checkIsNamePrimitive` before. 
 */
export function getLiteralOfName(ast: AST): string {
    assertIsOp(ast)
    let inner = ast.operands[0]
    assertIsLiteral(inner)
    return inner.value
}

/** 
 * Extracts `n` out of ```[#number 'n]``` as a number using parseFloat. 
 * This function assumes `ast` has the correct form. If you're not sure of that, use `checkIsNumberPrimitive` before.
 */
export function getLiteralOfNumber(ast: AST): number {
    assertIsOp(ast)
    let inner = ast.operands[0]
    assertIsLiteral(inner)
    return parseFloat(inner.value)
}

/** 
 * Extracts `s` out of ```[#string 's]``` as a string. 
 * This function assumes `ast` has the correct form. If you're not sure of that, use `checkIsStringPrimitive` before.
 */
export function getLiteralOfString(ast: AST): string {
    assertIsOp(ast)
    checkArity(ast, 1)
    let inner = ast.operands[0]
    checkIsLiteral(inner)
    return inner.value
}

/** Tells the Typescript compiler you're sure this `ast` is a `MacroAST`. Does nothing. */
export function assertIsMacro(ast: AST): asserts ast is MacroAST {}

/** Tells the Typescript compiler you're sure this `ast` is a `OpAST`. Does nothing. */
export function assertIsOp(ast: AST): asserts ast is OpAST {}

/** Tells the Typescript compiler you're sure this `ast` is a `LiteralAST`. Does nothing. */
export function assertIsLiteral(ast: AST): asserts ast is LiteralAST {}



/** 
 * An object used to specify the syntactic types of expressions within a Micro checker. See {@link lang} for more details. 
 */
export type TypeSpecifier = {
    [s: string]: TypeSpecifier,
    [s: symbol]: any,
    (expected: TypeSpecifier, otherwise?: string): void
}

const __types = Symbol()
function typeSpecifier(...types: string[]): TypeSpecifier {

    let func: any = (actual: TypeSpecifier, msg: string = "") => {
        let accepted = hasType(actual, spec)

        if (!accepted) {
            let actualTypes = actual[__types] as unknown as string[]
            let expectedTypes = spec[__types] as unknown as string[]
            error(`Expected ${last(expectedTypes)} (${expectedTypes.join('.')}), got ${last(actualTypes)} (${actualTypes.join('.')}). ${msg}`)
        }

        return actual
    }

    let spec: TypeSpecifier = new Proxy<any>(
        func,
        {
            get: (_, p) => {
                if (p === __types) return types
                else return typeSpecifier(...types, p.toString())
            },
            set: () => { 
                throw "Type specifiers' properties can't be set." 
            }
        }
    )

    return spec
}

/** Returns wether or not `actual` can be considered of type `expected`. See {@link lang} for more details. */
export function hasType(actual: TypeSpecifier, expected: TypeSpecifier) {
    let actualTypes = actual[__types] as string[]
    let expectedTypes = expected[__types] as string[]
    return expectedTypes.every((type, i) => type === actualTypes[i])
}


/**
 * Root type specifier. Type specifiers are used to mark expressions as originating from a specific syntactic
 * construct, and to ensure these specific constructs are the ones required. 
 * 
 * Syntax : 
 * * `lang.expr.variable` : Creates a new type specifier named `lang.expr.variable`.
 * * `lang.expr.variable (type)` : Requires the type specifier `type` to originate from a construct named `lang.expr.variable`.
 * 
 * Usage : `let plus = (a,b) => { lang.expr (a); lang.expr (b); return lang.expr }` would for instance declare an operator checker
 * that ensures both operands to `+` have the `lang.expr` syntactic type, and marks `+` as another `lang.expr` by returning that syntactic type.
 * 
 * Type specifiers are implemented with JS' `Proxy` class, so any name can be used : writing `lang.my.type.specifier` yields a
 * perfectly valid, brand new type specifier. Type specifiers can also be created dynamically : if `prim_type` is one of `"name"`, `"number"`,
 * `"string"`, for instance, `lang.expr[prim_type]` will yield `lang.expr.name`, `lang.expr.number` or `lang.expr.string`, respectively.
 * 
 * Construct requirements allow for more specific origins that the one specified, e.g `lang.expr (type)` would succeed 
 * if `type` were `lang.expr.variable`. Similarly, two specifiers instanciated at different places (which are thus two 
 * different JS objects) that share the exact same name will be considered the same for all practical purposes.
 */
export const lang = typeSpecifier("lang")
