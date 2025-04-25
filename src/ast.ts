import { Metadata, throwWith } from "./metadata";
import { arity, between, Dictionary, toRangeArity } from "./_util";


/** 
 * An AST representing a macro call 
 * @field metadata: Please refer to the Metadata documentation.
 * @field type: Always "macro". Identifies this AST type among the others.
 * @field name: The name of the called macro
 * @field head: The head (argument list) that was passed to the macro when calling it.
 * @field body: The statements inside the body of the macro, in order.
 * @field limbs: An object whose fields are the limbs of the macro.
 */
export type MacroAST = { metadata: Metadata; type: "macro"; name: string; head: AST[]; body: AST[]; limbs: Dictionary<AST[]>; }


/** 
 * An AST representing an operation
 * @field metadata: Please refer to the Metadata documentation.
 * @field type: Always "operation". Identifies this AST type among the others.
 * @field operator: The (possibly symbolic) name of the operator. 
 * @field operands : The operands that the operator acts on.
 */
export type OpAST = { metadata: Metadata; type: "operation"; operator: string; operands: AST[]; }

/** 
 * An AST representing a literal excerpt of the source code.
 * @field metadata: Please refer to the Metadata documentation.
 * @field type: Always "literal". Identifies this AST type among the others.
 * @field value: A string that matches the excerpt of the source code.
 */
export type LiteralAST = { metadata: Metadata; type: "literal"; value: string; }

/** 
 * An AST representing a piece of code. Can be a MacroAST, an OPAst, or a LiteralAST.
 */
export type AST = MacroAST | OpAST | LiteralAST


/** Utility function provided for debuging purposes, pretty-printing ast with n spaces for indent. */
export function printAst(ast: AST, n = 0) {
    let indent = " ".repeat(n*4)
    switch (ast.type) {
        case "literal": 
            console.log(indent + "`"+ast.value+"`")
            break

        case "operation": 
            console.log(indent+ast.operator)
            ast.operands.map(op => printAst(op, n+1))
            break

        case "macro":
            console.log(indent+ast.name+"(...)")
            ast.body.forEach(stmt => printAst(stmt, n+1))
            for (let limbName in ast.limbs) {
                if (ast.limbs[limbName].length > 0) {
                    console.log(indent+limbName)
                    ast.limbs[limbName].forEach(stmt => printAst(stmt, n+1))
                }
            }
    }
}

/** Asserts this ast represents an operation. */
export function assertOp(ast: AST, msg: string = "An operation was expected."): asserts ast is OpAST {
    if (ast.type !== "operation") throwWith(ast.metadata, msg)
}

/** Asserts this operation ast matches the provided operator. */
export function assertOpkind(name: string, ast: OpAST, msg: string = `A '${name}' operator was expected.`) {
    if (ast.operator !== name) throwWith(ast.metadata, msg)
}

/** Asserts this operation ast has that many arguments. Both endpoints inclusive if a range is provided. */
export function assertArity(n: arity, ast: OpAST, msg?: string) {
    let range = toRangeArity(n)
    if (!between(...range, ast.operands.length)) {
        throwWith(ast.metadata, msg ?? `Expected between ${range[0]} and ${range[1]} arguments, got ${ast.operands.length}.`)
    }
}

/** Asserts this ast is a macro ast. */
export function assertMacro(ast: AST, msg: string = "A macro was expected."): asserts ast is MacroAST {
    if (ast.type !== "macro") throwWith(ast.metadata, msg)
}

/** Asserts this macro ast matches the provided macro name. */
export function assertMacrokind(name: string, ast: MacroAST, msg: string = `A '${name}' operator was expected.`) {
    if (ast.name !== name) throwWith(ast.metadata, msg)
}

/** Asserts this ast is a literal ast. */
export function assertLiteral(ast: AST, msg: string = "A literal was expected."): asserts ast is LiteralAST {
    if (ast.type !== "literal") throwWith(ast.metadata, msg)
}

/** Extracts `lit` out of ```[#name `lit`]``` as a string. */
export function getLiteralOfName(ast: AST): string {
    assertOp(ast)
    assertOpkind("#name", ast)
    assertArity(1, ast)
    let inner = ast.operands[0]
    assertLiteral(inner)
    return inner.value
}

/** Extracts `x` out of ```[#number `x`]``` as a number using parseFloat. */
export function getLiteralOfNumber(ast: AST): number {
    assertOp(ast)
    assertOpkind("#number", ast)
    assertArity(1, ast)
    let inner = ast.operands[0]
    assertLiteral(inner)
    return parseFloat(inner.value)
}

/** Asserts ast is a literal ast and retrieves its value field. */
export function getValue(ast: AST): string {
    assertLiteral(ast)
    return ast.value
}

/** 
 * Builds a macro ast out of the provided parameters.
 * @see MacroAST
 */
export function macro(name: string, head: AST[], body: AST[], limbs: Dictionary<AST[]> = {}, metadata: Metadata): MacroAST {
    return {
        type: "macro",
        name,
        metadata,
        head,
        body,
        limbs
    }
}

/** 
 * Builds an operation ast out of the provided parameters.
 * @see OpAST
 */
export function operation(operands: AST[], operator: string, metadata: Metadata): OpAST {
    return {
        type: "operation",
        metadata,
        operator,
        operands,
    }
} 

/** 
 * Builds a literal ast out of the provided parameters.
 * @see LiteralAST
 */
export function literal(value: string, metadata: Metadata, ): LiteralAST {
    return {
        type: "literal",
        metadata,
        value
    }
}