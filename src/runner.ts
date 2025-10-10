import { MicroParser } from "./parser"
import { MicroReducer, Value } from "./reducer"



/** 
 * An abstract class meant to group a parser, checkers and a reducer to compile and
 * run Micro scripts.
 */
export abstract class MicroRunner {

    /** The parser that will be used to generate an AST out of the source scripts. */
    abstract parser: MicroParser

    /** The reducers that will go throught the AST to check it. */
    checkers: MicroReducer[] = []

    /** 
     * The reducer that will reduce the AST produced by the parser. 
     * Its return result will be understood as the value produced by the script.
     */
    abstract reducer: MicroReducer

    /** 
     * Parses the script, and returns the value that reducing it produces. Is the exact same as : 
     * ```
     * let exec = runner.compile(src, args)
     * return exec()
     * ```
     */
    run(src: string, args: string[] = []): Value {
        let exec = this.compile(src, args)
        return exec()
    }

    /** Compiles the script, i.e parses it, checks it, and returns a function that reduces it when called */
    compile(src: string, args: string[] = []): () => Value {
        let ast = this.parser.parse(src, args)
        this.checkers.forEach(c => c.reduce(ast))
        return () => this.reducer.reduce(ast) 
    }
}