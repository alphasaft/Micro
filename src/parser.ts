import { Dictionary } from "./_util";
import { AST, LiteralAST, MacroAST, OpAST, } from "./ast"
import { MicroLexer, MicroToken as Token, MicroTokenKind as TokenKind, TokenStream } from "./lexer"
import { Metadata, throwWith } from "./metadata";




type rangeArity = [number, number]
type arity = number | rangeArity;
let toRangeArity = (n: arity): rangeArity => typeof n === "number" ? [n,n] : n

/** An arity equal to [0, Infinity]. */
export let any: arity = [0, Infinity]
/** An arity equal to [1, Infinity]. */
export let oneOrMore: arity = [1, Infinity]
/** An arity equal to [2, Infinity]. */
export let twoOrMore: arity = [2, Infinity]


/**
 * The expected syntax for the macro.
 * - block is the default setting and imposes no restriction whatsoever,
 * - inline enforces inline or one-expression body, as well as inline limbs,
 * - half-inline enforces inline limbs and enables the limbs-first syntax
 */
type MacroMode = "block" | "inline" | "half-inline" ;

/**
 * A macro declaration.
 * @field name - The macro name.
 * @field arity - The macro arity. Can be of the form n or [n,m], inclusive at both endpoints.
 * @field limbs - The name of the different limbs in the right order.
 * @field mode - See MacroMode. Defaults to "block".
 */
type MacroDeclaration = { name: string; arity: arity; limbs?: string[]; mode?: MacroMode };

/**
 * An operato declaration.
 * @field name - The operator name.
 * @field arity - The operator arity. Can be of the form n or [n,m], inclusive at both endpoints.
 */
type OpDeclaration = { name: string; arity: arity } 


type InternalMacroDeclaration = { arity: [number, number], limbs: string[], mode: MacroMode }
type InternalOpDeclaration = { precedence: number, arity: [number, number] }


type ParserConfig = {
    operators: (OpDeclaration[] | OpDeclaration)[],
    macros: MacroDeclaration[],
}

/** An abstract class that parses a specific version of the Micro language. */
export abstract class MicroParser {
    static readonly numberOp = "#number"
    static readonly stringOp = "#string"
    static readonly nameOp = "#name"
    static readonly listOp = "#list"
    static readonly tupleOp = "#tuple"
    static readonly callOp = "#call"
    static readonly indexOp = "#index"

    private operators: Dictionary<InternalOpDeclaration>
    private macros: Dictionary<InternalMacroDeclaration>
    private lexer: MicroLexer

    /**
     * Constructs a new MicroParser with the supplied operator and macro declarations ; these will be the only ones that can
     * be used in the scripts, and the provided arity will be enforced while parsing.
     * 
     * The order in which the operators are supplied is understood as their relative precedence : higher operators will be the ones
     * with the highest precedence. If two operators should have the same precedence, wrap them side by side in a list. On the other hand, 
     * the order in which the macros are declared doesn't matter.
     * 
     */
    constructor({ operators, macros }: ParserConfig) { 
        this.operators = {}
        for (let i = 0; i<operators.length; i++) {
            let slice = operators[i]
            if ("includes" in slice) for (let op of slice) {
                this.operators[op.name] = { arity: toRangeArity(op.arity), precedence: operators.length-i}
            } else {
                let op = slice
                this.operators[op.name] = { arity: toRangeArity(op.arity), precedence: operators.length-i}
            }
        }

        this.macros = {}
        for (let macro of macros) {
            this.macros[macro.name] = { arity: toRangeArity(macro.arity), limbs: macro.limbs ?? [], mode: macro.mode ?? "block" }
        }

        this.lexer = new MicroLexer()
    }

    private checkOperatorExists(operator: string, metadata: Metadata) {
        if (!(operator in this.operators)) throwWith(metadata, `Unknown operator '${operator}'.`)
    }

    private makeOperation(operator: string, operands: AST[], metadata: Metadata): OpAST {
        this.checkOperatorExists(operator, metadata)
        this.checkOperatorArity(metadata, operator, operands.length)
        return { type: "operation", operator, operands, metadata }
    }

    private checkOperatorArity(metadata: Metadata, name: string, operandCount: number) {
        let arity = this.operators[name].arity
        if (operandCount < arity[0]) {
            throwWith(metadata, `Operator '${name}' expects at least ${arity[0]} operand(s), got ${operandCount}.`)
        } else if (operandCount > arity[1]) {
            throwWith(metadata, `Operator '${name}' expects at most ${arity[1]} operand(s), got ${operandCount}. Perhaps you forgot a semicolon somewhere ?`)
        }
    }

    private checkMacroExists(name: string, metadata: Metadata) {
        if (!(name in this.macros)) throwWith(metadata, `Unknown macro '${name}'.`)
    }

    private makeMacro(name: string, body: AST[], args: AST[], limbs: Dictionary<AST[]>, metadata: Metadata): AST {
        this.checkMacroExists(name, metadata)
        this.checkMacroArity(metadata, name, args.length)
        for (let limb in limbs) this.checkMacroHasLimb(metadata, name, limb)
        for (let limb of this.macros[name].limbs) limbs[limb] = limbs[limb] ?? []
        return { type: "macro", name, body, head: args, limbs, metadata }
    }

    private checkMacroArity(metadata: Metadata, macro: string, argcount: number) {
        let arity = this.macros[macro].arity
        if (argcount < arity[0]) {
            throwWith(metadata, `Macro '${macro}' expects at least ${arity[0]} argument(s), got ${argcount}.`)
        } else if (argcount > arity[1]) {
            throwWith(metadata, `Macro '${macro}' expects at most ${arity[0]} argument(s), got ${argcount}.`)
        }
    }

    private checkMacroHasLimb(metadata: Metadata, macro: string, limb: string) {
        let limbs = this.macros[macro].limbs
        if (!limbs.includes(limb)) throwWith(metadata, `Macro '${macro}' doesn't accept a limb called ${limb}.`)
    }


    private makeLiteral(token: Token): LiteralAST {
        return { type: "literal", value: token.value, metadata: token.metadata }
    }
    
    private makeLiteralOperation(op: string, token: Token): OpAST {
        return this.makeOperation(op, [this.makeLiteral(token)], token.metadata )
    } 


    private parseExpressionSequence(tokens: TokenStream, end: TokenKind): AST[] {
        let sequence: AST[] = []
        while (true) {
            if (tokens.is(end)) break
            sequence.push(this.parseExpression(tokens))
            if (tokens.is(TokenKind.SEMICOLON)) tokens.next()
        }

        return sequence
    }

    private parseEnclosedExpressionSequence(left: TokenKind, right: TokenKind, tokens: TokenStream): [AST[], Metadata] {
        let begin = tokens.expect(left).metadata.span[0]
        let args = this.parseExpressionSequence(tokens, right)
        let end = tokens.expect(right).metadata.span[1]
        return [args, { src: tokens.src, span: [begin, end] }]
    }

    private parseNumber(tokens: TokenStream): AST {
        return this.makeLiteralOperation(MicroParser.numberOp, tokens.next())
    }

    private parseString(tokens: TokenStream): AST {
        return this.makeLiteralOperation(MicroParser.stringOp, tokens.next())
    }
    
    private parseNameOrMacro(tokens: TokenStream): AST {
        let nameToken = tokens.next()
        let name = nameToken.value
        if (tokens.is(TokenKind.TICK) || name in this.macros) return this.parseMacro(nameToken, tokens)
        else return this.makeLiteralOperation(MicroParser.nameOp, nameToken)
    }

    private parseMacro(nameToken: Token, tokens: TokenStream): AST {
        let name = nameToken.value
        let binding = tokens.is(TokenKind.TICK) ? this.parseMacroBinding(tokens) : null
        if (binding) name += "'"
        let macroDeclaration = this.macros[name]

        let [head, headMeatadata] = this.parseMacroHead(tokens, macroDeclaration); if (binding !== null) head = [binding, ...head]
        this.checkMacroArity(headMeatadata, name, head.length)
        let [body, _] = this.parseMacroBody(tokens, macroDeclaration)
        let [limbs, limbsMetadata] = this.parseMacroLimbs(tokens, name, macroDeclaration)
        let metadata: Metadata = { src: tokens.src, span: [headMeatadata.span[0], limbsMetadata.span[1]] }
        
        return this.makeMacro( 
            name, 
            body, 
            head, 
            limbs,
            metadata,
        )
    }

    private parseMacroBinding(tokens: TokenStream): LiteralAST {
        tokens.expect(TokenKind.TICK)
        let boundTo = tokens.expect(TokenKind.NAME)
        return this.makeLiteral(boundTo)
    }

    private parseMacroHead(tokens: TokenStream, macroDeclaration: InternalMacroDeclaration): [AST[], Metadata] {
        if (tokens.is(TokenKind.OPENING_PAR)) {
            if (
                (macroDeclaration.mode === "inline" || macroDeclaration.mode === "half-inline")
                && macroDeclaration.arity[0] === 0 && macroDeclaration.arity[1] === 0
            ) throwWith(tokens.peak().metadata, "Parentheses are forbidden here.")

            return this.parseEnclosedExpressionSequence(TokenKind.OPENING_PAR, TokenKind.CLOSING_PAR, tokens)
        } else {
            return [[], { src: tokens.src, span: [tokens.loc(), tokens.loc()] }]
        }
    }

    private parseMacroBody(tokens: TokenStream, dec: InternalMacroDeclaration): [AST[], Metadata] {
        if (tokens.is(TokenKind.OPENING_CBRACKET)) {
            if (dec.mode === "inline") {
                let begin = tokens.next().metadata.span[0]
                if (tokens.is(TokenKind.CLOSING_CBRACKET)) throwWith(tokens.peak().metadata, "A one-expression body can't be empty.")
                let expr = this.parseExpression(tokens)
                if (tokens.is(TokenKind.SEMICOLON)) throwWith(tokens.peak().metadata, "A one-expression body can't include semicolons.")
                let end = tokens.expect(TokenKind.CLOSING_CBRACKET).metadata.span[1]
                return [[expr], { src: tokens.src, span: [begin, end] }]
            } else {
                return this.parseEnclosedExpressionSequence(TokenKind.OPENING_CBRACKET, TokenKind.CLOSING_CBRACKET, tokens)
            }
        } else {
            let expr = this.parseExpression(tokens)
            return [[expr], expr.metadata]
        }
    }

    private parseMacroLimbs(tokens: TokenStream, name: string, macro: InternalMacroDeclaration): [Dictionary<AST[]>, Metadata] {
        let { limbs, mode } = macro
        let limbsASTs: Dictionary<AST[]> = {}

        let limbsIndex = 0
        let begin = tokens.loc()
        let end = tokens.loc()
        while (tokens.is(TokenKind.NAME)) {
            let limbNameToken = tokens.next()
            let limbName = limbNameToken.value

            while (limbsIndex < limbs.length && limbs[limbsIndex] !== limbName) limbsIndex++
            if (limbsIndex === limbs.length) {
                let metadata = limbNameToken.metadata
                if (limbs.includes(limbName)) throwWith(metadata, `Limb '${limbName}' was not at its place.`)
                else throwWith(metadata, `Macro '${name}' does not have a '${limbName}' limb. Perhaps you forgot a semicolon ?`)
            } else limbsIndex++
            
            if (tokens.is(TokenKind.OPENING_CBRACKET)) {
                if (mode === "inline" || mode === "half-inline") {
                    tokens.next()
                    let expr = this.parseExpression(tokens)
                    if (tokens.is(TokenKind.SEMICOLON)) throwWith(tokens.peak().metadata, "A single-expression body can't end with a semicolon.")
                    end = tokens.expect(TokenKind.CLOSING_CBRACKET).metadata.span[1]
                    limbsASTs[limbName] = [expr]
                } else {
                    let [exprs, metadata] = this.parseEnclosedExpressionSequence(TokenKind.OPENING_CBRACKET, TokenKind.CLOSING_CBRACKET, tokens)
                    limbsASTs[limbName] = exprs
                    end = metadata.span[1]
                }
            } else {
                let expr = this.parseExpression(tokens)
                limbsASTs[limbName] = [expr]
                end = expr.metadata.span[1]
            }
        }

        return [limbsASTs, { src: tokens.src, span: [begin, end] }]
    }

    private parseSilentMacro(tokens: TokenStream): AST {
        let [body, metadata] = this.parseEnclosedExpressionSequence(TokenKind.OPENING_CBRACKET, TokenKind.CLOSING_CBRACKET, tokens)
        return this.makeMacro("", body, [], {}, metadata)
    }

    private parseParenthesizedExpression(tokens: TokenStream): AST {
        let begin = tokens.expect(TokenKind.OPENING_PAR).metadata.span[0]
        let end = begin
        let { tupleOp } = MicroParser

        if (tokens.is(TokenKind.CLOSING_PAR)) {
            end = tokens.next().metadata.span[1]
            return this.makeOperation(tupleOp, [], { src: tokens.src, span: [begin, end] })
        }

        let ast = this.parseExpression(tokens)

        if (tokens.is(TokenKind.SEMICOLON)) {
            tokens.next()
            let args = this.parseExpressionSequence(tokens, TokenKind.CLOSING_PAR)
            end = tokens.expect(TokenKind.CLOSING_PAR).metadata.span[1]
            return this.makeOperation(tupleOp, [ast, ...args], { src: tokens.src, span: [begin, end] })
        }
        
        tokens.expect(TokenKind.CLOSING_PAR)
        return ast
    }
    
    private parseExplicitPack(tokens: TokenStream): AST {
        let begin = tokens.expect(TokenKind.OPENING_BRACKET).metadata.span[0]
        let operator = tokens.is(TokenKind.OPERATOR) ? tokens.next().value : MicroParser.listOp
        let operands = this.parseExpressionSequence(tokens, TokenKind.CLOSING_BRACKET)
        let end = tokens.expect(TokenKind.CLOSING_BRACKET).metadata.span[1]

        return this.makeOperation(operator, operands, { src: tokens.src, span: [begin, end] })
    }

    private parseUnaryOperation(tokens: TokenStream): AST {
        let operatorToken = tokens.expect(TokenKind.OPERATOR)
        let operator = operatorToken.value
        let begin = operatorToken.metadata.span[0]
        let operand = this.parseExpression(tokens, this.operators[operator].precedence)
        let end = operand.metadata.span[1]
        return this.makeOperation(operator, [operand], { src: tokens.src, span: [begin, end] })
    }
    
    private parseExpression(tokens: TokenStream, minPrecedance: number = 0): AST {
        let { callOp, indexOp } = MicroParser
        let leftSide = this.parseOperand(tokens)
 
        while (true) {
            if (tokens.is(TokenKind.OPERATOR)) {
                let op = tokens.next().value
                if (this.operators[op].precedence <= minPrecedance) break 

                let currentOp = op
                let packingOp = op
                let args = [leftSide]
                while (currentOp === packingOp) {
                    args.push(this.parseExpression(tokens, this.operators[op].precedence))
                    if (!tokens.is(TokenKind.OPERATOR)) break;
                    currentOp = tokens.next().value
                }
                let metadata: Metadata = { src: tokens.src, span: [args[0].metadata.span[0], args[args.length-1].metadata.span[1]] }
                leftSide = this.makeOperation(op, args, metadata)

            } else if (tokens.is(TokenKind.OPENING_PAR)) {
                if (this.operators[callOp].precedence <= minPrecedance) break

                let [args, argsMetadata] = this.parseEnclosedExpressionSequence(TokenKind.OPENING_PAR, TokenKind.CLOSING_PAR, tokens)
                let metadata: Metadata = { src: tokens.src, span: [leftSide.metadata.span[0], argsMetadata.span[1]] }
                leftSide = this.makeOperation(callOp, [leftSide, ...args], metadata)

            } else if (tokens.is(TokenKind.OPENING_BRACKET)) {
                if (this.operators[indexOp].precedence <= minPrecedance) break

                let [args, argsMetadata] = this.parseEnclosedExpressionSequence(TokenKind.OPENING_BRACKET, TokenKind.CLOSING_BRACKET, tokens)
                let metadata: Metadata = { src: tokens.src, span: [leftSide.metadata.span[0], argsMetadata.span[1]] }
                leftSide = this.makeOperation(indexOp, [leftSide, ...args], metadata)

            } else {
                break
            }
        }

        return leftSide
    }

    private parseOperand(tokens: TokenStream): AST {
        switch (tokens.peak().kind) {
            case TokenKind.STRING: return this.parseString(tokens)
            case TokenKind.NAME: return this.parseNameOrMacro(tokens)
            case TokenKind.NUMBER: return this.parseNumber(tokens)
            case TokenKind.OPERATOR: return this.parseUnaryOperation(tokens)
            case TokenKind.OPENING_PAR: return this.parseParenthesizedExpression(tokens)
            case TokenKind.OPENING_BRACKET: return this.parseExplicitPack(tokens)
            case TokenKind.OPENING_CBRACKET: return this.parseSilentMacro(tokens)
            case TokenKind.EOF: throwWith(tokens.peak().metadata, "Expression expected.")
            default: throwWith(tokens.peak().metadata, "Unexpected character.")
        }
    }

    /** 
     * Parses the script `src` according to the parser's provided macro and operator declarations.
     * If additional arguments are given, they are passed down to the resulting script macro in its head as literals.
     */
    parse(src: string, ...scriptArgs: string[]): MacroAST {
        let tokens = this.lexer.tokenize(src)
        let body = this.parseExpressionSequence(tokens, TokenKind.EOF)
        return {
            type: "macro",
            name: "<script>",
            metadata: { src, span: [0, src.length-1] },
            body,
            head: scriptArgs.map(arg => { return { type: "literal", value: arg, metadata: { src, span: [0,0] } } }),
            limbs: {}
        }
    }
}


