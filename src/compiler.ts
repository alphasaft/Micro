import { AST, ASTMetadata } from "./ast"
import { Context } from "./context"
import { Evaluator } from "./evaluator"
import { MacroDeclaration, MacroReducer } from "./macro"
import { OpDeclaration, OpReducer } from "./operator"
import { MapLike } from "./util"

type char = string
type length = number
type index = number

type InternalOpDeclaration = { precedence: number, arity: [number, number] }
type InternalMacroDeclaration = { arity: [number, number], limbs: string[] }

export function between(a: number, b: number, x: number) {
    return a <= x && x <= b
}

export class MicroCompiler<T> {
    static readonly WHITESPACE_CHARS = "\n\t "
    static readonly OPERATOR_CHARS = "&|~^@=+-'$*%!§/:.,?!<>"
    static readonly zeroCC = '0'.charCodeAt(0)
    static readonly nineCC = '9'.charCodeAt(0)

    private operators: MapLike<InternalOpDeclaration>
    private macros: MapLike<InternalMacroDeclaration>

    constructor(
        operators: (OpDeclaration | OpDeclaration[])[],
        macros: MacroDeclaration[],
        private lift: (literal: string) => T,
        private scriptMacro: MacroReducer<T>,
    ) { 
        this.operators = {}
        for (let i = 0; i<operators.length; i++) {
            let slice = operators[i]
            for (let op of "includes" in slice ? slice : [slice]) {
                this.operators[op.name] = { arity: typeof op.arity === "number" ? [op.arity, op.arity] : op.arity, precedence: operators.length-i}
            }
        }

        this.macros = {}
        for (let macro of macros) {
            this.macros[macro.name] = { arity: typeof macro.arity === "number" ? [macro.arity, macro.arity] : macro.arity, limbs: macro.limbs ?? [] }
        }
    }

    private isEOF(src: string, i: index) {
        return i >= src.length
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
        let error = (msg: string) => this.error(metadata.fullSrc, metadata.loc, msg)

        this.checkOperatorExists(operator, metadata.fullSrc, metadata.loc)
        this.checkOperatorArity(operator, operands.length, metadata.fullSrc, metadata.loc)

        return { type: "operation", operator, operands, metadata }
    }

    private checkOperatorExists(name: string, src: string, i: index) {
        if (!(name in this.operators)) this.error(src, i, `Unknown operator '${name}'.`)
    }

    private checkOperatorArity(name: string, operandCount: number, src: string, i: index) {
        this.checkOperatorExists(name, src, i)
        let arity = this.operators[name].arity
        if (!between(...arity, operandCount)) this.error(src, i, `Operator '${name}' expects between ${arity.join(" and ")} arguments, got ${operandCount}.`)
    }

    private makeMacro(name: string, body: AST[], args: AST[], limbs: MapLike<AST[]>, metadata: ASTMetadata): AST {
        this.checkMacroExists(name, metadata.fullSrc, metadata.loc)
        this.checkMacroArity(name, args.length, metadata.fullSrc, metadata.loc)
        for (let limb in limbs) this.checkMacroHasLimb(name, limb, metadata.fullSrc, metadata.loc)
        return { type: "macro", name, body, args, limbs, metadata }
    }
    
    private checkMacroExists(macro: string, src: string, i: index) {
        if (!(macro in this.macros)) this.error(src, i, `Unknown macro '${name}'.`)            
    }

    private checkMacroArity(macro: string, argcount: number, src: string, i: index) {
        this.checkMacroExists(macro, src, i)
        let arity = this.macros[macro].arity
        if (!between(...arity, argcount)) {
            this.error(src, i, `Macro '${name}' expects between ${arity.join(" and ")} arguments, got ${argcount}.`)
        }
    }

    private checkMacroHasLimb(macro: string, limb: string, src: string, i: index) {
        this.checkMacroExists(macro, src, i)
        let limbs = this.macros[macro].limbs
        if (!limbs.includes(limb)) this.error(src, i, `Macro '${macro}' doesn't accept a limb called ${limb}.`)
    }


    private makeLiteral(value: string, metadata: ASTMetadata): AST {
        return { type: "literal", value, metadata }
    }
    
    private makeLiteralOperation(op: string, value: string, metadata: ASTMetadata): AST {
        return this.makeOperation(op, [this.makeLiteral(value, metadata)], metadata)
    }

    private makeMetadata(src: string, i: number, j: number): ASTMetadata {
        return { fullSrc: src, src: src.substring(i, j), loc: i }
    }

    private flush(src: string, i: index): length {
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
                if (j >= src.length) this.error(src, src.length, "Unclosed comment.")
            } while (depth > 0)
        } else {
            while (this.isWhitespace(src, j)) {
                j++
            }
        }

        return j-i > 0 ? this.flush(src, j) + j-i : j-i
    }

    private getLC(src: string, i: number): [number, number] {
        let lineNo = [...src.substring(0, i)].filter(c => c === '\n').length + 1
        let columnNo = src.substring(0, i).split("\n").at(-1)!.length
        return [lineNo, columnNo]
    }

    private error(src: string, i: number, msg: string): never {
        let [lineNo, columnNo] = this.getLC(src, i)
        let line = src.split("\n")[lineNo-1]
        throw `At (${lineNo}, ${columnNo}) : "${line}" : ${msg}`
    }
    
    private parseSymbolicOperator(src: string, i: index): [string, length] {
        let j = i
        while (this.isSymbolicOperatorChar(src, j)) j++
        return [src.substring(i, j), j-i]
    }

    private parseHashOperator(src: string, i: index): [string, length] {
        let j = i+1
        while (this.isLetter(src, j)) j++
        return [src.substring(i, j), j-i]
    }

    private parseIdentifier(src: string, i: index): [string, length] {
        i += this.flush(src, i)

        let j = i
        if (!this.isLetter(src, j)) this.error(src, i, "Letters expected.")
        else j++
        while (this.isLetterOrNumber(src, j)) j++

        return [src.substring(i, j), j-i]
    }

    private parseString(src: string, i: index): [AST, length] {
        i += this.flush(src, i)

        let j = i
        if (src[j] !== '"') this.error(src, i, "'\"' expected.")
        j += 1 + this.flush(src, j+1)

        let args: AST[] = []
        while (true) {
            if (src[j] === '{') {
                j++
                let [arg, consumed] = this.parseExpression(src, j)
                j += consumed + this.flush(src, j+consumed)
                if (src[j] !== '}') this.error(src, j, "'}' expected.")
                j++
                args.push(arg)
            } else {
                let k = j
                while (!this.isEOF(src, k) && src[k] !== '{' && src[k] !== '"') k++
                args.push(this.makeLiteral(src.substring(j, k),this.makeMetadata(src, j, k)))
                j = k
                if (this.isEOF(src, k)) this.error(src, k, "'\"' expected.")
                else if (src[k] === '"') { j++ ; break }
            }
        }

        return [
            this.makeOperation("#string", args, this.makeMetadata(src, i, j)),
            j-i
        ]
    }

    private parseNumber(src: string, i: index): [AST, length] {
        i += this.flush(src, i)

        let j = i
        while (this.isNumber(src, j)) j++
        if (src[j] === '.') j++
        while (this.isNumber(src, j)) j++

        return [this.makeLiteralOperation("#number", src.substring(i, j), this.makeMetadata(src, i, j)), j-i]
    }

    private parseExpressionSequence(src: string, i: index, end: char, start?: char): [AST[], length] {
        let [l,c] = this.getLC(src, i)

        i += this.flush(src, i)
        let j = i

        if (start) {
            if (src[j] !== start) this.error(src, i, `'${start}' expected.`)
            j += 1+this.flush(src, j+1)
        }

        if (src[j] === end) {
            j++
            return [[], j-i]
        }

        let sequence: AST[] = []
        let done = false
        while (!done) {
            let [expr, consumed] = this.parseExpression(src, j)   
            j += consumed + this.flush(src, j+consumed)
            let semicolonSeen = src[j] === ';'
            if (src[j] === ';') j += 1 + this.flush(src, j+1)
            let endSeen = src[j] === end
            if (src[j] === end) {
                done = true
                j++
            } 
            if (!(semicolonSeen || endSeen)) this.error(src, j, `';' expected.`)
            sequence.push(expr)
        }

        return [sequence, j-i]
    }
    
    private parseMacroOrName(src: string, i: index): [AST, length] {
        i += this.flush(src, i)
        let j = i

        let [name, consumed1] = this.parseIdentifier(src, j)
        j += consumed1 + this.flush(src, j+consumed1)

        let [boundTo, consumed2] = this.isLetter(src, j) ? (([s,l]): [AST, length] => [this.makeLiteral(s, this.makeMetadata(src, j, j+l)), l])(this.parseIdentifier(src, j)) : [null, 0]
        j += consumed2 + this.flush(src, j+consumed2)
        let [args, consumed3] = src[j] === '(' ? this.parseExpressionSequence(src, j, ')', '(') : [null, 0]
        j += consumed3 + this.flush(src, j+consumed3)

        if (src[j] === '{') {
            this.checkMacroExists(name, src, i)
            let [body, consumed4] = this.parseExpressionSequence(src, j, '}', '{')    
            j += consumed4

            let limbs: MapLike<AST[]> = {}
            let flush = this.flush(src, j)
            while (this.isLetter(src, j+flush)) {
                j += flush
                let [limbName, consumed5] = this.parseIdentifier(src, j)
                this.checkMacroHasLimb(name, limbName, src, j)
                if (limbName in limbs) this.error(src, j, "Can't declare twice the limb '" + limbName + "'.")
                j += consumed5 + this.flush(src, j+consumed5)
                let [limb, consumed6] = this.parseExpressionSequence(src, j, '}', '{')
                limbs[limbName] = limb
                j += consumed6
                flush = this.flush(src, j)
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

        if (boundTo !== null) this.error(src, i+name.length, "Operator expected.")
        
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
        i += this.flush(src, i)
        let j = i+1 + this.flush(src, i+1)
        let [ast, consumed] = this.parseExpression(src, j)
        j += consumed + this.flush(src, j+consumed)
        if (src[j] !== ')') this.error(src, j, "')' expected.")
        j++
        return [ast, j-i]
    }

    private parseBracketedExpression(src: string, i: index): [AST, length] {
        i += this.flush(src, i)
        let j = i+1
        j += this.flush(src, j)

        return this.isOperatorFirstChar(src, j) 
            ? this.parsePrefixBracketedExpression(src, i) 
            : this.parseInfixBracketedExpression(src, i)
    }
    
    private parsePrefixBracketedExpression(src: string, i: index): [AST, length] {
        i += this.flush(src, i)
        let j = i
        if (src[j] !== '[') this.error(src, j, "'[' expected.")
        j += 1+this.flush(src, i+1)
        let [operator, consumed] = this.parseOperator(src, j)
        j += consumed + this.flush(src, j+consumed)
        let [operands, consumed2] = this.parseExpressionSequence(src, j, ']')
        j += consumed2

        return [this.makeOperation(operator, operands, this.makeMetadata(src, i, j)), j-i]
    }

    private parseInfixBracketedExpression(src: string, i: index): [AST, length] {
        i += this.flush(src, i)
        if (src[i] !== '[') this.error(src, i, "'[' expected.")
        let j = i+1+this.flush(src, i+1)

        let [operatorands, consumed] = this.preparseOperands(src, j)
        j += consumed + this.flush(src, j+consumed)
        if (this.isExpressionFirstChar(src, j)) {
            let [trailingOperator, consumed] = this.parseOperator(src, j)
            j += consumed + this.flush(src, j+consumed)
            operatorands.push(trailingOperator)
        }
        if (src[j] !== ']') this.error(src, j, "']' expected.")
        j++

        if (operatorands.length < 2) this.error(src, i, "Infix bracket expressions expect at least an operand and an operator.")

        let operator = operatorands[1] as string
        for (let k = 1; k<operatorands.length; k+=2) {
            if (operatorands[k] as string !== operator) {
                this.error(src, i, "Syntax error : Only a single type of operator is allowed inside a bracket expression."
                    + "Enclose subexpressions in parentheses if needed.")
            }
        }

        let operands: AST[] = []
        for (let i = 0; i<operatorands.length; i+=2) operands.push(operatorands[i] as AST)

        return [this.makeOperation(operator, operands, this.makeMetadata(src, i, j)), j-i]
    }

    private parseUnaryOperation(src: string, i: index): [AST, length] {
        i += this.flush(src, i)

        let j = i
        let [operator, consumed1] = this.parseOperator(src, j)
        j += consumed1 + this.flush(src, j+consumed1)
        let [operand, consumed2] = this.parseExpression(src, j, this.operators[operator].precedence+1)
        j += consumed2 + this.flush(src, j+consumed2)

        return [this.makeOperation(operator, [operand], this.makeMetadata(src, i, j)), j-i]
    }

    private parseExpression(src: string, i: index, minPrecedence: number = 0): [AST, length] {
        i += this.flush(src, i)

        let j = i
        let [operatorands, consumed] = this.preparseOperands(src, j, minPrecedence)
        j += consumed + this.flush(src, j+consumed)

        let self = this
        function fold(operatorands: (AST | string)[]): AST {
            if (operatorands.length === 1) return operatorands[0] as AST

            let lowestPrecedenceIndex: index = 1
            let lowestPrecedence: number = self.operators[operatorands[1] as string].precedence
            for (let k = 1; k<operatorands.length; k+=2) {
                let op = operatorands[k] as string
                if (!(op in self.operators)) self.error(src, (operatorands[k-1] as AST).metadata.loc, `Unknown operator '${op}'.`)

                let precedence = self.operators[op].precedence
                if (lowestPrecedence >= precedence) {
                    lowestPrecedence = precedence
                    lowestPrecedenceIndex = k
                }
            }
            let operator = operatorands[lowestPrecedenceIndex] as string
            let left = operatorands.slice(0, lowestPrecedenceIndex)
            let right = operatorands.slice(lowestPrecedenceIndex+1)

            return self.makeOperation(
                operator,
                [fold(left), fold(right)],
                self.makeMetadata(
                    src, 
                    (operatorands[0] as AST).metadata.loc, 
                    (m => m.loc + m.src.length)((operatorands.at(-1) as AST).metadata)
                )
            )
        }

        return [fold(operatorands), j-i]
    }

    private preparseOperands(src: string, i: index, minPrecedence: number = 0): [(AST | string)[], length] {
        let operatorands: (AST | string)[] = []

        i += this.flush(src, i)
        let j = i
        let [firstOperand, consumed] = this.parseOperand(src, j)
        j += consumed + this.flush(src, j+consumed)
        operatorands.push(firstOperand)

        while (this.isOperatorFirstChar(src, j)) {
            let [operator, consumed1] = this.parseOperator(src, j)

            if (this.operators[operator].precedence < minPrecedence) break

            let flush = this.flush(src, j+consumed1)
            if (!this.isExpressionFirstChar(src, j+consumed1+flush)) break 
            else j += consumed1 + flush

            let [operand, consumed2] = this.parseOperand(src, j)
            j += consumed2 + this.flush(src, j+consumed2)
            
            operatorands.push(operator, operand)
        }

        return [operatorands, j-i]
    }

    private parseOperator(src: string, i: index): [string, length] {
        let [op, consumed] = this.isSymbolicOperatorChar(src, i)
            ? this.parseSymbolicOperator(src, i)
            : this.parseHashOperator(src, i)
        
        if (!(op in this.operators)) this.error(src, i, `Unknown operator '${op}'.`)

        return [op, consumed]
    }

    private isExpressionFirstChar(src: string, i: index) {
        return i < src.length && (this.isLetter(src, i) || this.isNumber(src, i) || this.isOperatorFirstChar(src, i) || "{([\"".includes(src[i]))
    }

    private parseOperand(src: string, i: index): [AST, length] {
        i += this.flush(src, i)
        let j = i

        let [operand, consumed] =
              this.isEOF(src, j)                  ? this.error(src, j, "Unexpected end of file while parsing operand.") 
            : this.isLetter(src, j)               ? this.parseMacroOrName(src, j)
            : this.isOperatorFirstChar(src, j)    ? this.parseUnaryOperation(src, j)
            : this.isNumber(src, j)               ? this.parseNumber(src, j)
            : src[j] === '('                      ? this.parseParenthesizedExpression(src, j)
            : src[j] === '['                      ? this.parseBracketedExpression(src, j)
            : src[j] === '"'                      ? this.parseString(src, j)
            : src[j] === '{'                      ? this.parseSilentMacro(src, j)
            : this.error(src, j, "Unexpected character : '" + src[j] + "'.")

        j += consumed
        let flush = this.flush(src, j)
        while (src[j+flush] === '(' || src[j+flush] === '[') {
            j += flush
            let operator = { '(': "#call", '[': "#index" }[src[j]]!
            let matchingEnd = { '(': ')', '[': ']' }[src[j]]!
            let [args, consumed] = this.parseExpressionSequence(src, j, matchingEnd, src[j])
            j += consumed 
            flush = this.flush(src, j+consumed)
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
                let macro = macros[name1] ?? this.error(metadata1.fullSrc, metadata1.loc, `Macro '${name1}' was declared, but not implemented.`)
                try {
                    return macro(this.makeContext(operators, macros), body, args, limbs)
                } catch (e) {
                    this.error(metadata1.fullSrc, metadata1.loc, "\n" + e as string)
                }

            case "operation":
                let { operator: name2, operands, metadata: metadata2 } = ast
                let evaluatedOperands = operands.map(x => this.eval(x, operators, macros))
                let operator = operators[name2] ?? this.error(metadata2.fullSrc, metadata2.loc, `Operator '${name2}' was declared, but not implemented.`)
                try {
                    return operator(evaluatedOperands)
                } catch (e) {
                    this.error(metadata2.fullSrc, metadata2.loc, e as string)
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

    compile(src: string): T {
        let asts = this.parseScript(src)
        return this.scriptMacro(this.makeContext({}, {}), asts, [], {}) 
    }
}

