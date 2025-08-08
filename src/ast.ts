import { Metadata } from "./metadata";
import { between, MapLike } from "./_util";


/** 
 * An AST representing a macro call 
 * @field metadata: Please refer to the Metadata documentation.
 * @field type: Always "macro". Identifies this AST type among the others.
 * @field name: The name of the called macro.
 * @field head: The head (argument list) that was passed to the macro when calling it as a list of ASTs.
 * @field body: The statements inside the body of the macro, in order and as a list of ASTs.
 * @field limbs: An object in which each field is a limb of the macro, as a list of ASTs.
 */
export type MacroAST = { metadata: Metadata; type: "macro"; name: string; head: AST[]; body: AST[]; limbs: MapLike<AST[]>; }


/** 
 * An AST representing an operation
 * @field metadata: Please refer to the Metadata documentation.
 * @field type: Always "operation". Identifies this AST type among the others.
 * @field operator: The (possibly symbolic) name of the operator. 
 * @field operands : The operands that the operator acts on as a list of ASTs.
 */
export type OpAST = { metadata: Metadata; type: "operation"; op: string; operands: AST[]; }

/** 
 * An AST representing a literal excerpt of the source code.
 * @field metadata: Please refer to the Metadata documentation.
 * @field type: Always "literal". Identifies this AST type among the others.
 * @field value: A string that matches the excerpt of the source code.
 */
export type LiteralAST = { metadata: Metadata; type: "literal"; value: string; }


/** An AST representing a piece of code. Can be a MacroAST, an OPAst, or a LiteralAST. */
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
                console.log(indent+ast.op)
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
