import { AST, MacroAST } from "./ast"
import { MicroParser } from "./parser"
import { MicroTransformer } from "./transformer"


/** 
 * An abstract class meant to group a parser, a runner, and optionally some preprocessors
 * to compile a Micro script.
 */
export abstract class MicroCompiler<T> {
    /** The parser that will generate a draft AST out of the source scripts. */
    protected abstract parser: MicroParser
    /** The transformers that will review the parser's draft and improve it if needed */
    protected preprocessors: MicroTransformer<AST>[] = []
    /** The runner that will run the final AST. */
    protected abstract runner: MicroTransformer<T>

    compile(src: string): T {
        return this.run(this.preprocess(src))
    }

    preprocess(src: string): MacroAST {
        let ast = this.parser.parse(src)
        for (let preprocessor of this.preprocessors) {
            ast = preprocessor.transform(ast) as MacroAST
            if (ast.type !== "macro") throw "Preprocessors should always return a MacroAST."
        }
        return ast
    }

    run(ast: MacroAST): T {
        return this.runner.transform(ast)
    }
}