import { MapLike } from "../src/_util";
import { AST } from "../src/ast";
import { lang, checkOpKind, checkIsOp, checkIsNamePrimitive, assertIsOp, getLiteralOfName } from "../src/checker";
import { MicroParser, oneOrMore, twoOrMore, zeroOrMore } from "../src/parser";
import { Evaluator, lar, MacroReducer, MicroReducer, OpReducer, Value, error, plain, plar } from "../src/reducer";
import { MicroRunner } from "../src/runner";



class DemandiseParser extends MicroParser {
    constructor() {
        super({
            operators: [
                [{ name: "#number", arity: 1 }, { name: "#string", arity: 1 }, { name: "#name", arity: 1 }],
                [{ name: "#list", arity: zeroOrMore }],
                [{ name: "|", arity: twoOrMore }],
                [{ name: "*", arity: twoOrMore }, { name: "/", arity: twoOrMore }],
                [{ name: "+", arity: oneOrMore }, { name: "-", arity: oneOrMore }],
                [{ name: "%", arity: 2 }],
                [{ name: ".", arity: twoOrMore }],
                [{ name: "::", arity: twoOrMore }],
                [{ name: ">=", arity: 2 }, { name: "<=", arity: 2 }, { name: "<", arity: 2 }, { name: ">", arity: 2 }, { name: "==", arity: twoOrMore }, { name: "!=", arity: 2 }],
                [{ name: "#print", arity: zeroOrMore }],
                [{ name: "#exception", arity: 1 }],
                [{ name: "$", arity: twoOrMore }],
                [{ name: ",", arity: 2 }],
                [{ name: "?", arity: 2 }],
                [{ name: "=", arity: 2 }, { name: "->", arity: 2 }],
            ],
            macros: [
                { name: "let", arity: 1, kind: "inline"},
                { name: "is", arity: [0,1], kind: "block" },
                { name: "with", arity: 1, kind: "inline", limbs: ["do"] },
                { name: "val", arity: 1, kind: "inline" },
            ]
        })
    }
}


class DemandiseSyntaxChecker extends MicroReducer {
    lift = () => lang.literal

    script: MacroReducer = ({use}, _, body) => {
        let primitiveOperator: (type: string) => OpReducer = type => 
            plain(l => {
                l (lang.literal)
                return lang.expr.primitive[type]
            })

        let stdOperator: OpReducer = plain((...args) => {
            args.forEach(arg => arg (lang.expr))
            return lang.expr
        })

        let checkIsPattern = ($: Evaluator, ast: AST) => {
            if (ast.type === "operation" && ast.op === ",") {
                let [pattern, guard] = ast.operands
                $(pattern) (lang.expr)
                $(guard) (lang.expr)
            } else {
                $(ast) (lang.expr)
            }
        }

        let $ = use({
            operators: {
                "#number": primitiveOperator("number"),
                "#string": primitiveOperator("string"),
                "#name": primitiveOperator("name"),

                "#list": stdOperator,
                ".": stdOperator,
                "|": stdOperator,
                "$": stdOperator,
                "%": stdOperator,
                "+": stdOperator,
                "-": stdOperator,
                "*": stdOperator,
                "/": stdOperator,
                "::": stdOperator,
                ">=": stdOperator,
                "<=": stdOperator,
                "<": stdOperator,
                ">": stdOperator,
                "#print": stdOperator,
                "#exception": stdOperator,
                "==": stdOperator,
                "!=": stdOperator
            },

            macros: {
                "let": ({use}, [letExpr]) => {
                    let $ = use({})

                    checkIsOp(letExpr, "=")
                    let [left, right] = letExpr.operands
                    checkIsOp(left); 
                    if (left.op === "#name") checkIsNamePrimitive(left) 
                    else {
                        checkOpKind(left, "|") 
                        let [name, ...params] = left.operands
                        checkIsNamePrimitive(name)
                        params.forEach(param => checkIsPattern($, param))
                    }
                    $(right) (lang.expr)
                    return lang.stmt.let
                }, 

                "is": ({use}, [value], body) => {
                    let $ = use({})

                    if (value !== undefined) {
                        $(value) (lang.expr)
                    }
                    
                    for (let stmt of body) {
                        checkIsOp(stmt, "?")
                        let [left, right] = stmt.operands
                        checkIsPattern($, left)
                        $(right) (lang.expr)
                    }
                    return lang.expr
                },

                "with": ({use}, [binding], _, { do: [expr] }) => {
                    let $ = use({})

                    $(expr) (lang.expr)

                    checkIsOp(binding, "=")
                    let [left, right] = binding.operands
                    checkIsOp(left)
                    if (left.op === "#name") { 
                        checkIsNamePrimitive(left) 
                    } else { 
                        checkOpKind(left, "|") 
                        left.operands.forEach(checkIsNamePrimitive)
                    }
                    $(right) (lang.expr)
                    return lang.expr
                },

                "val": ({use}, [binding]) => {
                    let $ = use({})

                    checkIsOp(binding, "=")
                    let [left, right] = binding.operands
                    checkIsOp(left)
                    if (left.op === "#name") checkIsNamePrimitive(left)
                    else { checkOpKind(left, "|"); left.operands.forEach(checkIsNamePrimitive) }
                    $(right) (lang.expr)
                    return lang.expr
                }
            }
        })

        for (let stmt of body) {
            $(stmt) (lang.stmt)
        }
    }
}


type Scope = { [v: string]: any }
type Scopes = { globals: Scope, locals: Scope }

class DemandiseReducer extends MicroReducer {
    lift = (l: string) => l

    script: MacroReducer = ({use}, _, body) => {
        let scopes: Scopes = { globals: {}, locals: {} }

        let $ = use({
            operators: {
                "#number": plain(parseFloat),
                "#string": plain(l => l),
                "#name": plain(l => {
                    switch (l) {
                        case "true": return true
                        case "false": return false
                        default: 
                            if (l in scopes.locals) return scopes.locals[l]
                            if (l in scopes.globals) return scopes.globals[l]
                            error("No such name : '" + l + "'.")
                    }
                }),

                "#list": plain((...args) => args),
                ".": plain((...fncts) => (arg: Value) => fncts.reduceRight((v, f) => f(v), arg)),
                "|": plar((f,x) => f(x)),
                "+": plar((a,b) => a+b),
                "-": plain((...args) => args.length === 1 ? -args[0] : args.reduce((a,b) => a-b)),
                "*": plar((a,b) => a*b),
                "/": plar((a,b) => a/b),
                "%": plain((a,b) => a%b),
                "<": plain((a,b) => a<b),
                ">": plain((a,b) => a>b),
                ">=": plain((a,b) => a>=b),
                "<=": plain((a,b) => a<=b),
                "!=": plain((a,b) => a!==b),
                "==": plain((...args) => { let arg0 = args[0]; for (let i=1; i<args.length; i++) if (args[i] !== arg0) return false; return true }),
                "::": plar((h,t) => [h, ...t]),
                "$": plar((f,x) => f(x)),
                "#print": plain((...args) => args.forEach(arg => console.log(arg))),
                "#exception": plain(msg => { error(`An error occured : ${msg}`) }),
            },

            macros: {
                "let": ({use}, [letExpr]) => {
                    let $ = use({})

                    assertIsOp(letExpr); let [left, right] = letExpr.operands
                    assertIsOp(left)
                    let [name, ...parameters] = (left.op === "|" ? left.operands : [left])
                    scopes.globals[getLiteralOfName(name)] = this.evaluateAsDeclaration($, scopes, parameters, right)
                },

                "is": ({use}, [expr], body) => {
                    let $ = use({})

                    let frozenLocals: Scope = { ...scopes.locals }
                    let f = (value: any) => {
                        for (let stmt of body) {
                            assertIsOp(stmt)
                            let [pattern, arm] = stmt.operands
                            assertIsOp(pattern)

                            let ambientLocals = scopes.locals
                            scopes.locals = frozenLocals
                            if (!this.bind(value, pattern, $, scopes)) {
                                scopes.locals = ambientLocals
                                continue
                            } else {    
                                let result = $(arm)
                                scopes.locals = ambientLocals
                                return result
                            }
                        }

                        error("Contract violation.")
                    }

                    return expr ? f($(expr)) : f
                },

                "with": ({use}, [binding], _, { do: [doExpr] }) => {
                    let $ = use({})

                    assertIsOp(binding)
                    let [left, right] = binding.operands
                    assertIsOp(left)
                    let [name, ...params] = (left.op === "|" ? left.operands : [left])
                    let ambientLocals = { ...scopes.locals }
                    let value = this.evaluateAsDeclaration($, scopes, params, right)
                    scopes.locals[getLiteralOfName(name)] = value
                    let result = $(doExpr)
                    scopes.locals = ambientLocals
                    return result
                },

                "val": ({use}, [binding]) => {
                    let $ = use({})

                    assertIsOp(binding)
                    let [left, right] = binding.operands
                    assertIsOp(left)
                    let [_, ...params] = (left.op === "|" ? left.operands : [left])
                    return this.evaluateAsDeclaration($, scopes, params, right)
                }
            }
        })
        
        for (let stmt of body) {
            $(stmt)
        }
    }

    private bind(value: any, pattern: AST, $: Evaluator, scopes: Scopes): boolean {
        assertIsOp(pattern)

        switch (pattern.op) {
            case "#list":
                if (!Array.isArray(value)) return false
                if (value.length !== pattern.operands.length) return false
                let subpatterns1 = pattern.operands
                let n1 = subpatterns1.length
                for (let i=0;i<n1;i++) if (!this.bind(value[i], subpatterns1[i], $, scopes)) return false
                return true
                
            case "::":
                if (!Array.isArray(value)) return false
                if (value.length < pattern.operands.length-1) return false
                let subpatterns2 = pattern.operands
                let n2 = subpatterns2.length
                for (let i=0;i<n2-1;i++) if (!this.bind(value[i], subpatterns2[i], $, scopes)) return false
                if (!this.bind(value.slice(n2-1), subpatterns2[n2-1], $, scopes)) return false
                return true
            
            case ",":
                let [innerPattern, guard] = pattern.operands
                if (!this.bind(value, innerPattern, $, scopes)) return false
                if (!$(guard)) return false
                return true

            case "#name":
                let name = getLiteralOfName(pattern)
                if (name !== "_") scopes.locals[name] = value
                return true
            
            default:
                return $(pattern) === value
        }
    }

    private curry(n: number, f: (params: any[]) => any, args: any[] = []) {
        return n === args.length 
            ? f(args)
            : (arg: any) => this.curry(n, f, [...args, arg])
    }

    private evaluateAsDeclaration($: Evaluator, scopes: Scopes, parameters: AST[], expr: AST) {
        if (parameters.length === 0) return $(expr)

        let frozenLocals = { ...scopes.locals }
        return this.curry(parameters.length, args => {
            let ambientLocals = scopes.locals
            scopes.locals = frozenLocals
            for (let i=0;i<parameters.length;i++) {
                if (!this.bind(args[i], parameters[i], $, scopes)) error("Contract violation.")
            }
            let result = $(expr)
            scopes.locals = ambientLocals
            return result
        })
    }
}

class DemandiseRunner extends MicroRunner {
    parser = new DemandiseParser;
    checkers = [new DemandiseSyntaxChecker];
    reducer = new DemandiseReducer;
}



export default new DemandiseRunner;


