import { MapLike } from "./util";

export type ASTType = "macro" | "operation" | "literal"
export type ASTMetadata = { src: string; excerpt: string; loc: number; };
export type AST =
    { metadata: ASTMetadata; type: ASTType } &
    ({ type: "macro"; name: string; args: AST[]; body: AST[]; limbs: MapLike<AST[]>; } |
    { type: "operation"; operator: string; operands: AST[]; } |
    { type: "literal"; value: string; });


function mapValues<T, R>(obj: MapLike<T>, f: (x: T) => R): MapLike<R> {
    let result: MapLike<R> = {} 
    for (let prop in obj) result[prop] = f(obj[prop])
    return result
}

/** 
 * Replaces every sub-AST of matching `type` inside `ast` until `depth` with the result of applying `f` to it. 
 * Replacement is done in a bottom-to-top fashion, so ASTs passed to `f` can have some of their members already replaced.
 * @param type - The type of AST that should be replaced
 * @param f - The function to apply
 * @param ast - The ast on which replacements should be performed.
 * @param depth - The maximum depth until which replacement should be performed in termes of nested macros, defaulting to Infinity
 */
export function replace<Type extends ASTType>(
    type: Type, 
    f: (ast: AST & { type: Type }) => AST,
    ast: AST,
    depth: number = Infinity,
): AST {
    let newAst: AST

    switch (ast.type) {
        case "literal": 
            newAst = ast
            break

        case "macro":
            newAst = depth === 0 
                ? ast
                : {
                    ...ast,
                    body: ast.body.map(ast => replace<Type>(type, f, ast, depth-1)),
                    args: ast.args.map(ast => replace<Type>(type, f, ast, depth)),
                    limbs: mapValues(ast.limbs, asts => asts.map(ast => replace<Type>(type, f, ast, depth-1)))
                }
            break

        case "operation":
            newAst = depth === 0
                ? ast 
                : {
                ...ast,
                operands: ast.operands.map(ast => replace<Type>(type, f, ast, depth)),
            }
    }

    return ast.type === type ? f(ast as AST & { type: Type }) : ast
}

/** 
 * Checks that `ast` is of the correct type and that its passes `check`, then returns it.
 * @param type - The expected type of AST
 * @param ast - The AST to check
 * @param check - An additional check defaulting to `ast => true`
 */
export function expect<Type extends ASTType>(
    type: Type, 
    ast: AST, 
    check: (ast: (AST & { type: Type } )) => boolean = () => true
): AST & { type: Type } {
    if (ast.type !== type || !check(ast as AST & { type: Type })) throw ""
    return ast as AST & { type: Type }
}


/** 
 * Throws `msg` with a header summarizing `metadata`
 * @param metadata - Info on where the error happened
 * @param msg - The error message
 */
export function throwWith(metadata: ASTMetadata, msg: string): never {
    let { src, excerpt, loc } = metadata
    let lineNo = [...src.substring(0, loc)].filter(c => c === '\n').length + 1
    let columnNo = src.substring(0, loc).split("\n").at(-1)!.length+1
    let excerptFirstLine = excerpt.split("\n")[0]!
    throw `At (${lineNo}, ${columnNo}) : "${excerptFirstLine}" : \n ${msg}`
}

/**
 * Indicates that this macro/operator is implemented using AST manipulation rather than
 * reducers. Returns a reducer that throws with `msg` if actually called.
 * @errorMsg The error message in the case it's called, defaults to "Internal error."
 */
export function intrinsic(errorMsg: string = "Internal error."): () => never {
    return () => {
        throw errorMsg
    }
}