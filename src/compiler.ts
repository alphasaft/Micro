import { AST, MacroAST } from "./ast"
import { MicroParser } from "./parser"
import { MicroTransformer } from "./transformer"


export abstract class MicroCompiler<T> {
    protected abstract parser: MicroParser
    protected abstract evaluator: MicroTransformer<T>
    protected preprocessors: MicroTransformer<AST>[] = []

    run(src: string): T {
        return this.eval(this.preprocess(src))
    }

    preprocess(src: string): MacroAST {
        let ast = this.parser.parse(src)
        for (let preprocessor of this.preprocessors) {
            ast = preprocessor.transform(ast) as MacroAST
            if (ast.type !== "macro") throw "Preprocessors should always return a MacroAST."
        }
        return ast
    }

    eval(ast: MacroAST): T {
        return this.evaluator.transform(ast)
    }
}