import { Metadata, throwWith } from "./metadata";
import { between, Dictionary } from "./_util";


/** 
 * An AST representing a macro call 
 * @field metadata: Please refer to the Metadata documentation.
 * @field type: Always "macro". Identifies this AST type among the others.
 * @field name: The name of the called macro.
 * @field head: The head (argument list) that was passed to the macro when calling it as a list of ASTs.
 * @field body: The statements inside the body of the macro, in order and as a list of ASTs.
 * @field limbs: An object in which each field is a limb of the macro, as a list of ASTs.
 */
export type MacroAST = { metadata: Metadata; type: "macro"; name: string; head: AST[]; body: AST[]; limbs: Dictionary<AST[]>; }


/** 
 * An AST representing an operation
 * @field metadata: Please refer to the Metadata documentation.
 * @field type: Always "operation". Identifies this AST type among the others.
 * @field operator: The (possibly symbolic) name of the operator. 
 * @field operands : The operands that the operator acts on as a list of ASTs.
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

/** Utility function provided for debuging purposes, pretty-printing ast with n (2 by default) spaces for indent. */
export function printAst(ast: AST, n = 2) {
    function _printAst(ast: AST, d = 0) {
        let indent = " ".repeat(d*n)
        switch (ast.type) {
            case "literal": 
                console.log(indent + "'"+ast.value)
                break

            case "operation": 
                console.log(indent+ast.operator)
                ast.operands.map(op => _printAst(op, d+1))
                break

            case "macro":
                console.log(indent+ast.name+"(...)")
                ast.body.forEach(stmt => _printAst(stmt, d+1))
                for (let limbName in ast.limbs) {
                    if (ast.limbs[limbName] !== undefined) {
                        console.log(indent + limbName)
                        ast.limbs[limbName].forEach(stmt => _printAst(stmt, d+1))
                    }
                }
        }
    }

    _printAst(ast, 0)
}


/** Asserts this ast represents an operation, throws otherwise with msg. */
export function assertOp(ast: AST, msg: string = "An operation was expected."): asserts ast is OpAST {
    if (ast.type !== "operation") throwWith(ast.metadata, msg)
}

/** Asserts this operation ast matches the provided operator, throws otherwise with msg. */
export function assertOpKind(ast: AST, name: string, msg: string = `A '${name}' operator was expected.`) {
    assertOp(ast, msg)
    if (ast.operator !== name) throwWith(ast.metadata, msg)
}

/** Asserts this operation ast has that many arguments, throws otherwise with msg. Both endpoints inclusive if a range is provided. */
export function assertArity(ast: OpAST, n: number | [number, number], msg?: string) {
    let range: [number, number] = typeof n === "number" ? [n,n] : n 
    if (!between(...range, ast.operands.length)) {
        throwWith(ast.metadata, msg ?? `Expected between ${range[0]} and ${range[1]} arguments, got ${ast.operands.length}.`)
    }
}

/** Asserts this ast is a macro ast, throws otherwise with msg. */
export function assertMacro(ast: AST, msg: string = "A macro was expected."): asserts ast is MacroAST {
    if (ast.type !== "macro") throwWith(ast.metadata, msg)
}

/** Asserts this macro ast matches the provided macro name, throws otherwise with msg. */
export function assertMacrokind(ast: AST, name: string, msg: string = `A '${name}' operator was expected.`) {
    assertMacro(ast, msg)
    if (ast.name !== name) throwWith(ast.metadata, msg)
}

/** Asserts this ast is a literal ast, throws otherwise with msg. */
export function assertLiteral(ast: AST, msg: string = "A literal was expected."): asserts ast is LiteralAST {
    if (ast.type !== "literal") throwWith(ast.metadata, msg)
}

/** Asserts this ast is a '#name' operator, throws otherwise with msg. */
export function assertName(ast: AST): asserts ast is OpAST {
    assertOp(ast)
    assertOpKind(ast, "#name")
}

/** Asserts this ast is a '#number' operator, throws otherwise with msg. */
export function assertNumber(ast: AST): asserts ast is OpAST {
    assertOp(ast)
    assertOpKind(ast, "#number")
}

/** Asserts this ast is a '#string' operator, throws otherwise with msg. */
export function assertString(ast: AST): asserts ast is OpAST {
    assertOp(ast)
    assertOpKind(ast, "#string")
}

/** Extracts `lit` out of ```[#name `lit`]``` as a string. */
export function getLiteralOfName(ast: AST): string {
    assertOp(ast)
    assertOpKind(ast, "#name")
    assertArity(ast, 1)
    let inner = ast.operands[0]
    assertLiteral(inner)
    return inner.value
}

/** Extracts `n` out of ```[#number `n`]``` as a number using parseFloat. */
export function getLiteralOfNumber(ast: AST): number {
    assertOp(ast)
    assertOpKind(ast, "#number")
    assertArity(ast, 1)
    let inner = ast.operands[0]
    assertLiteral(inner)
    return parseFloat(inner.value)
}

/** Extracts `s` out of ```[#string `s`]``` as a string. */
export function getLiteralOfString(ast: AST): string {
    assertOp(ast)
    assertOpKind(ast, "#string")
    assertArity(ast, 1)
    let inner = ast.operands[0]
    assertLiteral(inner)
    return inner.value
}

/** Asserts ast is a literal ast and retrieves its value field. */
export function getValue(ast: AST): string {
    assertLiteral(ast)
    return ast.value
}
