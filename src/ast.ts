import { Metadata } from "./metadata";
import { between, MapLike } from "./_util";


/** 
 * An AST representing a macro invokation.
 * @property metadata: See {@link Metadata}.
 * @property type Always "macro". Identifies this AST type among the others.
 * @property name The name of the called macro.
 * @property head The head (argument list) that was passed to the macro when calling it as a list of ASTs.
 * @property body The statements inside the body of the macro, in order and as a list of ASTs.
 * @property limbs An object in which each field is a limb of the macro, as a list of ASTs.
 */
export type MacroAST = { metadata: Metadata; type: "macro"; name: string; head: AST[]; body: AST[]; limbs: MapLike<AST[]> }


/** 
 * An AST representing an operation.
 * @property metadata See {@link Metadata}.
 * @property type Always "operation". Identifies this AST type among the others.
 * @property op The (possibly symbolic) name of the operator. 
 * @property operands The operands that the operator acts on as a list of ASTs.
 */
export type OpAST = { metadata: Metadata; type: "operation"; op: string; operands: AST[] }

/** 
 * An AST representing a literal excerpt of the source code.
 * @property metadata Please refer to the Metadata documentation.
 * @property type Always "literal". Identifies this AST type among the others.
 * @property value A string that matches the excerpt of the source code.
 */
export type LiteralAST = { metadata: Metadata; type: "literal"; value: string; }


/** An AST representing a piece of code. Can be a {@link MacroAST}, an {@link OpAST}, or a {@link LiteralAST}. */
export type AST = MacroAST | OpAST | LiteralAST 


/** 
 * Utility function provided for debuging purposes, returning a string representation of ast with `n`
 * (2 by default) spaces for indent. 
 */
export function reprAST(ast: AST, n = 2): string {
    let s = ""

    function _reprAST(ast: AST, d = 0) {
        let indent = " ".repeat(d*n)
        switch (ast.type) {
            case "literal": 
                s += indent + "'"+ast.value + '\n'
                break

            case "operation": 
                s += indent+ast.op + '\n'
                ast.operands.map(op => _reprAST(op, d+1))
                break

            case "macro":
                s += indent + ast.name + "(...)\n"
                ast.body.forEach(stmt => _reprAST(stmt, d+1))
                for (let limbName in ast.limbs) {
                    if (ast.limbs[limbName] !== undefined) {
                        s += indent + limbName + '\n'
                        ast.limbs[limbName].forEach(stmt => _reprAST(stmt, d+1))
                    }
                }
        }
    }

    _reprAST(ast, 0)
    return s
}
