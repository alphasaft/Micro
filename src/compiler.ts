import { AST, ASTMetadata, expect } from "./ast"
import { Context } from "./context"
import { MacroDeclaration, MacroReducer } from "./macro"
import { OpDeclaration, OpReducer } from "./operator"
import { MapLike } from "./util"
import { throwWith } from "./ast"

type char = string
type length = number
type index = number

type InternalOpDeclaration = { precedence: number, arity: [number, number] }
type InternalMacroDeclaration = { arity: [number, number], limbs: string[] }

function between(a: number, b: number, x: number) {
    return a <= x && x <= b
}

// TODO : Make built-in syntax errors also gain headers.

export class MicroCompiler<T> {
    static readonly WHITESPACE_CHARS = "\n\t "
    static readonly OPERATOR_CHARS = "&|~^@=+-'$*%!§/:.,?!<>"
    static readonly zeroCC = '0'.charCodeAt(0)
    static readonly nineCC = '9'.charCodeAt(0)
    static readonly callOp = "#call"
    static readonly indexOp = "#index"
    static readonly bindOp = "#bind"
    static readonly numberOp = "#number"
    static readonly stringOp = "#string"
    static readonly nameOp = "#name"

    private operators: MapLike<InternalOpDeclaration>
    private macros: MapLike<InternalMacroDeclaration>

    /** 
     * Creates a new Micro Compiler. For more precisions, see the README.md file.
     * @param operators - The declaration for the operators. The order is used as the operators precedences.
     * If you wish to declare two operators with the same precedence, nest them together in a list.
     * @param macros - The declarations for the macros.
     * @param lift - A function that promotes a string to a usable object of type T.
     * @param scriptMacro - The global macro reducer that will be used to evaluate scripts.
     */
    constructor(
        operators: OpDeclaration[][],
        macros: MacroDeclaration[],
        private lift: (literal: string) => T,
        private scriptMacro: MacroReducer<T>,
    ) { 
        this.operators = {}
        for (let i = 0; i<operators.length; i++) {
            let slice = operators[i]
            for (let op of slice) {
                this.operators[op.name] = { arity: typeof op.arity === "number" ? [op.arity, op.arity] : op.arity, precedence: operators.length-i}
            }
        }

        this.macros = {}
        for (let macro of macros) {
            this.macros[macro.name] = { arity: typeof macro.arity === "number" ? [macro.arity, macro.arity] : macro.arity, limbs: macro.limbs ?? [] }
        }
    }

    private isEOF(src: string, i: index) {
        return i >= src.length || src[i] === '\0'
    }

    private isSymbolicOperatorChar(src: string, i: index) {
        return !this.isEOF(src, i) && MicroCompiler.OPERATOR_CHARS.includes(src[i])
    }

    private isWhitespace(src: string, i: index) {
        return !this.isEOF(src, i) && MicroCompiler.WHITESPACE_CHARS.includes(src[i])
    }
    
    private isLetter(src: string, i: index) {
        return !this.isEOF(src, i) && (src[i].toLowerCase() !== src[i].toUpperCase() || src[i] === "_")
    }

    private isLetterOrNumber(src: string, i: index) {
        return !this.isEOF(src, i) && (this.isLetter(src, i) || this.isNumber(src, i))
    }

    private isNumber(src: string, i: index) {
        return !this.isEOF(src, i) && between(MicroCompiler.zeroCC, MicroCompiler.nineCC, src.charCodeAt(i))
    }

    private isOperatorFirstChar(src: string, i: index) {
        return i < src.length && (src[i] === '#' || this.isSymbolicOperatorChar(src, i))
    }


    private makeOperation(operator: string, operands: AST[], metadata: ASTMetadata): AST {
        this.checkOperatorExists(metadata, operator)
        this.checkOperatorArity(metadata, operator, operands.length)
        return { type: "operation", operator, operands, metadata }
    }

    private checkOperatorExists(metadata: ASTMetadata, name: string) {
        if (!(name in this.operators)) {
            throwWith(metadata, "Unknown operator.")
        }
    }

    private checkOperatorArity(metadata: ASTMetadata, name: string, operandCount: number) {
        this.checkOperatorExists(metadata, name)
        let arity = this.operators[name].arity
        if (!between(...arity, operandCount)) {
            throwWith(metadata, `Operator '${name}' expects between ${arity.join(" and ")} arguments, got ${operandCount}.`)
        }
    }

    private makeMacro(name: string, body: AST[], args: AST[], limbs: MapLike<AST[]>, metadata: ASTMetadata): AST {
        this.checkMacroExists(metadata, name)
        this.checkMacroArity(metadata, name, args.length)
        for (let limb in limbs) this.checkMacroHasLimb(metadata, name, limb)
        for (let limb in this.macros[name].limbs) limbs[limb] = limbs[limb] ?? []
        return { type: "macro", name, body, args, limbs, metadata }
    }
    
    private checkMacroExists(metadata: ASTMetadata, macro: string) {
        if (!(macro in this.macros)) throwWith(metadata, `Unknown macro.`)            
    }

    private checkMacroArity(metadata: ASTMetadata, macro: string, argcount: number) {
        this.checkMacroExists(metadata, macro)
        let arity = this.macros[macro].arity
        if (!between(...arity, argcount)) {
            throwWith(metadata, `Macro '${macro}' expects between ${arity.join(" and ")} arguments, got ${argcount}.`)
        }
    }

    private checkMacroHasLimb(metadata: ASTMetadata, macro: string, limb: string) {
        this.checkMacroExists(metadata, macro)
        let limbs = this.macros[macro].limbs
        if (!limbs.includes(limb)) throwWith(metadata, `Macro '${macro}' doesn't accept a limb called ${limb}.`)
    }


    private makeLiteral(value: string, metadata: ASTMetadata): AST {
        return { type: "literal", value, metadata }
    }
    
    private makeLiteralOperation(op: string, value: string, metadata: ASTMetadata): AST {
        return this.makeOperation(op, [this.makeLiteral(value, metadata)], metadata)
    }

    private makeMetadata(src: string, i: number, j: number): ASTMetadata {
        return { src: src, excerpt: src.substring(i, j), loc: i }
    }

    private flushed(src: string, i: index): index {
        let j = i

        if (src.substring(j, j+2) === "[[") {
            let depth = 0
            do {
                switch (src.substring(j, j+2)) {
                    case "[[": 
                        j += 2
                        depth++
                        break
                    
                    case "]]":
                        j += 2
                        depth--
                    
                    default:
                        j++
                }
                if (j >= src.length) throwWith(this.makeMetadata(src, i, src.length), "Unclosed comment.")
            } while (depth > 0)
        } else {
            while (this.isWhitespace(src, j)) {
                j++
            }
        }

        return j-i > 0 ? this.flushed(src, j) : j
    }
    
    private parseSymbolicOperator(src: string, i: index): [string, length] {
        let j = i
        while (this.isSymbolicOperatorChar(src, j)) j++
        return [src.substring(i, j), j-i]
    }

    private parseHashOperator(src: string, i: index): [string, length] {
        i = this.flushed(src, i)
        let j = i
        if (src[j] !== '#') throwWith(this.makeMetadata(src, j, j+1), "'#' expected.")
        while (this.isLetterOrNumber(src, j)) j++
        return [src.substring(i, j), j-i]
    }

    private parseIdentifier(src: string, i: index): [string, length] {
        i = this.flushed(src, i)

        let j = i
        if (!this.isLetter(src, j)) throwWith(this.makeMetadata(src, i, i+1), "Letters expected.")
        else j++
        while (this.isLetterOrNumber(src, j)) j++

        return [src.substring(i, j), j-i]
    }

    private parseString(src: string, i: index): [AST, length] {
        i = this.flushed(src, i)

        let j = i
        if (src[j] !== '"') throwWith(this.makeMetadata(src, i, i+1), "'\"' expected.")
        j = this.flushed(src, j+1)

        let args: AST[] = []        
        if (src[j] === '{') args.push(this.makeLiteral("", this.makeMetadata(src, j, j)))
        while (true) {
            if (src[j] === '{') {
                j++
                let [arg, consumed] = this.parseExpression(src, j)
                j = this.flushed(src, j+consumed)
                if (src[j] !== '}') throwWith(this.makeMetadata(src, j, j+1), "'}' expected.")
                j++
                args.push(arg)
            } else {
                let k = j
                while (!this.isEOF(src, k) && src[k] !== '{' && src[k] !== '"') k++
                args.push(this.makeLiteral(src.substring(j, k), this.makeMetadata(src, j, k)))
                j = k
                if (this.isEOF(src, k)) throwWith(this.makeMetadata(src, k, k+1), "Closing '\"' expected before end of file.")
                else if (src[k] === '"') { j++ ; break }
            }
        }

        return [
            this.makeOperation("#string", args, this.makeMetadata(src, i, j)),
            j-i
        ]
    }

    private parseNumber(src: string, i: index): [AST, length] {
        i = this.flushed(src, i)

        let j = i
        while (this.isNumber(src, j)) j++
        if (src[j] === '.') j++
        while (this.isNumber(src, j)) j++

        return [this.makeLiteralOperation("#number", src.substring(i, j), this.makeMetadata(src, i, j)), j-i]
    }

    private parseExpressionSequence(src: string, i: index, end: char, start?: char): [AST[], length] {
        i = this.flushed(src, i)
        let j = i

        if (start) {
            if (src[j] !== start) throwWith(this.makeMetadata(src, i, i+1), `'${start}' expected.`)
            j = this.flushed(src, j+1)
        }

        if (src[j] === end) {
            j++
            return [[], j-i]
        }

        let sequence: AST[] = []
        let done = false
        while (!done) {
            let [expr, consumed] = this.parseExpression(src, j)   
            j = this.flushed(src, j+consumed)
            let semicolonSeen = src[j] === ';'
            if (src[j] === ';') j = this.flushed(src, j+1)
            let endSeen = src[j] === end
            if (src[j] === end) {
                done = true
                j++
            }
            if (!(semicolonSeen || endSeen)) throwWith(this.makeMetadata(src, j, j+1), `';' expected.`)
            sequence.push(expr)
        }

        return [sequence, j-i]
    }
    
    private parseMacroOrName(src: string, i: index): [AST, length] {
        i = this.flushed(src, i)
        let j = i

        let [name, consumed1] = this.parseIdentifier(src, j)
        j = this.flushed(src, j+consumed1)

        let [boundTo, consumed2] = this.isLetter(src, j) ? (([s,l]): [AST, length] => [this.makeLiteral(s, this.makeMetadata(src, j, j+l)), l])(this.parseIdentifier(src, j)) : [null, 0]
        j = this.flushed(src, j+consumed2)
        let [args, consumed3] = src[j] === '(' ? this.parseExpressionSequence(src, j, ')', '(') : [null, 0]
        j = this.flushed(src, j+consumed3)

        if (src[j] === '{') {
            this.checkMacroExists(this.makeMetadata(src, i, i+consumed1), name)
            let [body, consumed4] = this.parseExpressionSequence(src, j, '}', '{')    
            j += consumed4

            let limbs: MapLike<AST[]> = {}
            let flushed = this.flushed(src, j)
            while (this.isLetter(src, flushed)) {
                j = flushed
                let [limbName, consumed5] = this.parseIdentifier(src, j)
                this.checkMacroHasLimb(this.makeMetadata(src, j, j+consumed5), name, limbName)
                if (limbName in limbs) throwWith(this.makeMetadata(src, j, j+consumed5), "Can't declare twice the limb '" + limbName + "'.")
                j = this.flushed(src, j+consumed5)
                let [limb, consumed6] = this.parseExpressionSequence(src, j, '}', '{')
                limbs[limbName] = limb
                j += consumed6
                flushed = this.flushed(src, j)
            }

            let metadata = this.makeMetadata(src, i, j)
            
            let macroAST: AST = this.makeMacro( 
                name, 
                body, 
                args ?? [], 
                limbs,
                metadata,
            )

            return [
                boundTo !== null
                ? this.makeOperation("#bind", [boundTo, macroAST], this.makeMetadata(src, i, j))
                : macroAST,
                j-i
            ]
        } 

        if (boundTo !== null) {
            let boundNameStart = i + consumed1 + this.flushed(src, i+consumed1)
            throwWith(this.makeMetadata(src, boundNameStart, boundNameStart+consumed2), "Operator expected.")
        }
        
        let metadata = this.makeMetadata(src, i, j)
        let nameAST = this.makeLiteralOperation("#name", name, metadata)
        if (args !== null) {
            return [
                this.makeOperation(
                    "#call", 
                    [nameAST, ...args], 
                    metadata,
                ), 
                j-i
            ]
        } else {
            return [nameAST, j-i]
        }
    }  

    private parseSilentMacro(src: string, i: index): [AST, length] {
        let [body, consumed] = this.parseExpressionSequence(src, i, '}', '{')
        return [this.makeMacro("", body, [], {}, this.makeMetadata(src, i, i+consumed)), consumed]
    }

    private parseParenthesizedExpression(src: string, i: index): [AST, length] {
        i = this.flushed(src, i)
        let j = i
        if (src[j] !== '(') throwWith(this.makeMetadata(src, j, j+1), "'(' expected.")
        j = this.flushed(src, j+1)
        let [ast, consumed] = this.parseExpression(src, j)
        j = this.flushed(src, j+consumed)
        if (src[j] !== ')') throwWith(this.makeMetadata(src, j, j+1), "')' expected.")
        j++
        return [ast, j-i]
    }

    private parseBracketedExpression(src: string, i: index): [AST, length] {
        i = this.flushed(src, i)
        let j = i+1
        j = this.flushed(src, j)

        return this.isOperatorFirstChar(src, j) 
            ? this.parsePrefixBracketedExpression(src, i) 
            : this.parseInfixBracketedExpression(src, i)
    }
    
    private parsePrefixBracketedExpression(src: string, i: index): [AST, length] {
        i = this.flushed(src, i)
        let j = i
        if (src[j] !== '[') throwWith(this.makeMetadata(src, j, j+1), "'[' expected.")
        j = this.flushed(src, i+1)
        let [operator, consumed] = this.parseOperator(src, j)
        j = this.flushed(src, j+consumed)
        let [operands, consumed2] = this.parseExpressionSequence(src, j, ']')
        j += consumed2

        return [this.makeOperation(operator, operands, this.makeMetadata(src, i, j)), j-i]
    }

    private parseInfixBracketedExpression(src: string, i: index): [AST, length] {
        i = this.flushed(src, i)
        if (src[i] !== '[') throwWith(this.makeMetadata(src, i, i+1), "'[' expected.")
        let j = this.flushed(src, i+1)

        let operatorands: (AST | string)[] = []
        let expectOperator = false
        while (true) {
            if (src[j] === ']') {
                break
            } else if (expectOperator) {
                let [op, consumed] = this.parseOperator(src, j) 
                operatorands.push(op)
                j = this.flushed(src, j+consumed)
            } else if (this.isExpressionFirstChar(src, j)) {
                let [operand, consumed] = this.parseOperand(src, j, false)
                operatorands.push(operand)
                j = this.flushed(src, j+consumed)
            }

            expectOperator = !expectOperator
        }

        if (operatorands.length < 2) throwWith(this.makeMetadata(src, i, j), "Infix bracket expressions expect at least an operand and an operator.")

        let operator = operatorands[1] as string
        for (let k = 1; k<operatorands.length; k+=2) {
            if (operatorands[k] as string !== operator) {
                throwWith(
                    this.makeMetadata(src, i, j), 
                    "Syntax error : Only a single type of operator is allowed inside a bracket expression." +
                    "Enclose subexpressions in parentheses if needed."
                )
            }
        }

        let operands: AST[] = []
        for (let k = 0; k<operatorands.length; k+=2) operands.push(operatorands[k] as AST)

        return [this.makeOperation(operator, operands, this.makeMetadata(src, i, j)), j-i]
    }

    private parseUnaryOperation(src: string, i: index): [AST, length] {
        i = this.flushed(src, i)

        let j = i
        let [operator, consumed1] = this.parseOperator(src, j)
        j = this.flushed(src, j+consumed1)
        let [operand, consumed2] = this.parseExpression(src, j, this.operators[operator].precedence)
        j = this.flushed(src, j+consumed2)

        return [this.makeOperation(operator, [operand], this.makeMetadata(src, i, j)), j-i]
    }

    private parseExpression(src: string, i: index, strictMinPrecedence: number = 0): [AST, length] {
        i = this.flushed(src, i)
        let j = i

        let { callOp, indexOp } = MicroCompiler
        let [leftSide, consumed1] = this.parseOperand(src, j)
        j = this.flushed(src, j+consumed1)

        while (true) {
            if (src[j] === '(') {
                this.checkOperatorExists(this.makeMetadata(src, j, j+1), callOp)
                if (this.operators[callOp].precedence <= strictMinPrecedence) break

                let [args, consumed2] = this.parseExpressionSequence(src, j, ')', '(')
                leftSide = this.makeOperation("#call", [leftSide, ...args], this.makeMetadata(src, i, j))
                j = this.flushed(src, j+consumed2)

            } else if (src[j] === '[') {
                this.checkOperatorExists(this.makeMetadata(src, j, j+1), indexOp)
                if (this.operators[indexOp].precedence <= strictMinPrecedence) break

                let [args, consumed3] = this.parseExpressionSequence(src, j, ']', '[')
                leftSide = this.makeOperation("#index", [leftSide, ...args], this.makeMetadata(src, i, j))
                j = this.flushed(src, j+consumed3)

            } else if (this.isOperatorFirstChar(src, j)) {
                let [op, consumed4] = this.parseOperator(src, j)
                if (this.operators[op].precedence <= strictMinPrecedence) break 

                j = this.flushed(src, j+consumed4)
                let [rightSide, consumed5] = this.parseExpression(src, j, this.operators[op].precedence)
                j += consumed5
                leftSide = this.makeOperation(op, [leftSide, rightSide], this.makeMetadata(src, i, j))
                j = this.flushed(src, j)

            } else {
                break
            }
        }

        return [leftSide, j-i]
    }

    private parseOperator(src: string, i: index): [string, length] {
        i = this.flushed(src, i)

        if (!this.isOperatorFirstChar(src, i)) throwWith(this.makeMetadata(src, i, i+1), "Operator expected.")

        let [op, consumed] = this.isSymbolicOperatorChar(src, i)
            ? this.parseSymbolicOperator(src, i)
            : this.parseHashOperator(src, i)
        
        this.checkOperatorExists(this.makeMetadata(src, i, i+consumed), op)

        return [op, consumed]
    }

    private isExpressionFirstChar(src: string, i: index) {
        return i < src.length && (this.isLetter(src, i) || this.isNumber(src, i) || this.isOperatorFirstChar(src, i) || "{([\"".includes(src[i]))
    }

    private parseOperand(src: string, i: index, allowUnaryOperations: boolean = true): [AST, length] {
        i = this.flushed(src, i)
        let j = i

        let [operand, consumed] =
              this.isEOF(src, j)                  ? throwWith(this.makeMetadata(src, j, j+1), "Unexpected end of file while parsing operand.") 
            : this.isLetter(src, j)               ? this.parseMacroOrName(src, j)
            : this.isNumber(src, j)               ? this.parseNumber(src, j)
            : this.isOperatorFirstChar(src, j) 
              && allowUnaryOperations             ? this.parseUnaryOperation(src, j)
            : src[j] === '('                      ? this.parseParenthesizedExpression(src, j)
            : src[j] === '['                      ? this.parseBracketedExpression(src, j)
            : src[j] === '"'                      ? this.parseString(src, j)
            : src[j] === '{'                      ? this.parseSilentMacro(src, j)
            : throwWith(this.makeMetadata(src, j, j+1), "Unexpected character : '" + src[j] + "'.")

        j += consumed
        let flushed = this.flushed(src, j)
        while (src[j+flushed] === '(' || src[j+flushed] === '[') {
            j = flushed
            let operator = { '(': "#call", '[': "#index" }[src[j]]!
            let matchingEnd = { '(': ')', '[': ']' }[src[j]]!
            let [args, consumed] = this.parseExpressionSequence(src, j, matchingEnd, src[j])
            j += consumed 
            flushed = this.flushed(src, j+consumed)
            operand = this.makeOperation(
                operator, 
                [operand, ...args], 
                this.makeMetadata(src, i, j) 
            )
        }

        return [operand, j-i]
    }


    private parseScript(src: string): AST[] {
        let [result, _] = this.parseExpressionSequence(src+'\0', 0, '\0')
        return result
    }

    private eval(
        ast: AST, 
        operators: MapLike<OpReducer<T>>, 
        macros: MapLike<MacroReducer<T>>,
    ): T {
        switch (ast.type) {

            case "literal":
                return this.lift(ast.value)

            case "macro":
                let { name: name1, args, body, limbs, metadata: metadata1 } = ast
                let macro = macros[name1]
                try {
                    return macro(this.makeContext(operators, macros), body, args, limbs)
                } catch (e) {
                    throwWith(metadata1, e as string)
                }

            case "operation":
                let { operator: name2, operands, metadata: metadata2 } = ast
                let operator = operators[name2]
                try {
                    let evaluatedOperands = operands.map(x => this.eval(x, operators, macros))
                    return operator(evaluatedOperands)
                } catch (e) {
                    throwWith(metadata2, e as string)
                }
        }
    }

    private makeContext(ambientOperators: MapLike<OpReducer<T>>, ambientMacros: MapLike<MacroReducer<T>>): Context<T> {
        let self = this
        return {
            ev(ast: AST, localOperators: MapLike<OpReducer<T>> = {}, localMacros: MapLike<MacroReducer<T>> = {}) {
                let fullOps: MapLike<OpReducer<T>> = { ...ambientOperators, ...localOperators }
                let fullMacros: MapLike<MacroReducer<T>> = { ...ambientMacros, ...localMacros }
                return self.eval(ast, fullOps, fullMacros)
            },
            operators: ambientOperators,
            macros: ambientMacros
        }
    }

    /** Compiles a script (using the provided macro reducer if given).
     * @param src - The script source code
     * @param scriptMacro - If provided, overrides `this.scriptMacro` for the script evaluation.
     */
    compile(src: string, scriptMacro: MacroReducer<T> = this.scriptMacro): T {
        let asts = this.parseScript(src)

        let defaultOperators: MapLike<OpReducer<T>> = {} 
        for (let op in this.operators) {
            defaultOperators[op] = () => { throw `This use of operator '${op}' is not legal here.` }
        }

        let defaultMacros: MapLike<MacroReducer<T>> = {}
        for (let macro in this.macros) {
            defaultOperators[macro] = () => { throw `This use of macro '${macro}' is not legal here.` }
        }

        return scriptMacro(this.makeContext(defaultOperators, defaultMacros), asts, [], {}) 
    }
}

