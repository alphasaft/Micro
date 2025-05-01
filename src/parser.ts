import { Dictionary } from "./_util";
import { AST, LiteralAST, MacroAST, OpAST, } from "./ast"
import { MicroLexer, MicroToken as Token, MicroTokenKind as TokenKind, TokenStream, canStartExpression } from "./lexer"
import { Metadata, throwWith } from "./metadata";




type rangeArity = [number, number]
type arity = number | rangeArity;
let toRangeArity = (n: arity): rangeArity => typeof n === "number" ? [n,n] : n

/** An arity equal to [0, Infinity]. */
export let zeroOrMore: arity = [0, Infinity]
/** An arity equal to [1, Infinity]. */
export let oneOrMore: arity = [1, Infinity]
/** An arity equal to [2, Infinity]. */
export let twoOrMore: arity = [2, Infinity]


/** The expected syntax for the macro. See the syntax reference for more details. */
type MacroKind = "block" | "inline" | "declaration";

/**
 * A macro declaration.
 * @field name - The macro name.
 * @field arity - The macro arity. Can be of the form n or [n,m], inclusive at both endpoints.
 * @field limbs - The name of the different limbs in the right order.
 * @field mode - See MacroMode. Defaults to "block".
 */
type MacroDeclaration = { name: string; arity: arity; limbs?: string[]; kind: MacroKind };

/**
 * An operato declaration.
 * @field name - The operator name.
 * @field arity - The operator arity. Can be of the form n or [n,m], inclusive at both endpoints.
 */
type OpDeclaration = { name: string; arity: arity } 


type InternalMacroDeclaration = { arity: [number, number], limbs: string[], mode: MacroKind }
type InternalOpDeclaration = { precedence: number, arity: [number, number] }


type ParserConfig = {
    operators: (OpDeclaration[] | OpDeclaration)[],
    macros: MacroDeclaration[],
}

/** An abstract class that can be subclassed to parse a specific version of the Micro language. */
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
            this.macros[macro.name] = { arity: toRangeArity(macro.arity), limbs: macro.limbs ?? [], mode: macro.kind ?? "block" }
        }

        this.lexer = new MicroLexer
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

    private makeMacro(name: string, body: AST[], args: AST[], limbs: Dictionary<AST[]>, metadata: Metadata): AST {
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
    
    private makePrimitiveOperation(op: string, token: Token): OpAST {
        return this.makeOperation(op, [this.makeLiteral(token)], token.metadata )
    } 


    private parseExpressionSequence(tokens: TokenStream, end: TokenKind): AST[] {
        let sequence: AST[] = []
        while (true) {
            if (tokens.is(end)) break
            sequence.push(this.parseExpression(tokens))
            if (tokens.is(TokenKind.SEMICOLON)) {
                tokens.next()
                if (tokens.is(end)) break
            }
            else if (tokens.is(end)) break
            else throwWith(tokens.peak().metadata, "Semicolon expected. Maybe you misspelled a macro name ?")
        }

        return sequence
    }

    private parseLiteral(tokens: TokenStream): AST {
        let start = tokens.expect(TokenKind.TICK).metadata.span[0]
        let name = tokens.expect(TokenKind.IDENTIFIER)
        let end = name.metadata.span[1]
        return { type: "literal", value: name.value, metadata: { src: tokens.src, span: [start, end] } }
    }
    
    private parseNumber(tokens: TokenStream): AST {
        return this.makePrimitiveOperation(MicroParser.numberOp, tokens.next())
    }

    private parseName(tokens: TokenStream): AST {
        return this.makePrimitiveOperation(MicroParser.nameOp, tokens.expect(TokenKind.IDENTIFIER))
    }
    
    private parseString(tokens: TokenStream): AST {
        let src = tokens.src
        let startingQuote = tokens.expect(TokenKind.QUOTE)
        let operands: AST[] = []
        let anchor = startingQuote.metadata.span[1]

        while (!tokens.is(TokenKind.QUOTE)) {
            if (tokens.is(TokenKind.LEFT_CBRACKET)) {
                let end = tokens.next().metadata.span[0]
                operands.push({ type: "literal", value: src.substring(anchor, end), metadata: { src, span: [anchor, end] } })
                operands.push(this.parseExpression(tokens))
                anchor = tokens.expect(TokenKind.RIGHT_CBRACKET).metadata.span[1]
            } else {        
                tokens.next()
            }
        }

        let endingQuote = tokens.expect(TokenKind.QUOTE)
        let stringEnd = endingQuote.metadata.span[0]
        operands.push({ type: "literal", value: src.substring(anchor, stringEnd), metadata: { src, span: [anchor, stringEnd] } })
        
        return this.makeOperation(
            MicroParser.stringOp,
            operands,
            { src: tokens.src, span:  [startingQuote.metadata.span[0], endingQuote.metadata.span[1]] }
        )
    }
    
    private parseNameOrMacro(tokens: TokenStream): AST {
        let name = tokens.peak().value
        return name in this.macros 
            ? this.parseMacro(tokens)
            : this.parseName(tokens)
    }

    private parseMacro(tokens: TokenStream): AST {
        let name = tokens.peak().value
        let macroDec = this.macros[name]
        switch (macroDec.mode) {
            case "block":
                return this.parseBlockMacro(tokens)
            case "inline":
                return this.parseInlineMacro(tokens)
            case "declaration":
                return this.parseDeclarativeMacro(tokens)
        }
    }

    private parseEnclosedExpressionSequence(left: TokenKind, right: TokenKind, tokens: TokenStream): [AST[], Metadata] {
        let begin = tokens.expect(left).metadata.span[0]
        let args = this.parseExpressionSequence(tokens, right)
        let end = tokens.expect(right).metadata.span[1]
        return [args, { src: tokens.src, span: [begin, end] }]
    }

    private parseBlockMacro(tokens: TokenStream): AST {
        let nameToken = tokens.expect(TokenKind.IDENTIFIER)
        let name = nameToken.value
        let macroDeclaration = this.macros[name]

        let [head, headMetadata]: [AST[], Metadata] = tokens.is(TokenKind.LEFT_PAR) 
            ? this.parseEnclosedExpressionSequence(TokenKind.LEFT_PAR, TokenKind.RIGHT_PAR, tokens)
            : [[], { src: tokens.src, span: [tokens.loc(), tokens.loc()]}]
        
        this.checkMacroArity(headMetadata, name, head.length)

        let body = tokens.is(TokenKind.LEFT_CBRACKET)
            ? this.parseEnclosedExpressionSequence(TokenKind.RIGHT_PAR, TokenKind.LEFT_BRACKET, tokens)[0]
            : [this.parseExpression(tokens)]

        let [limbs, limbsMetadata] = this.parseMacroLimbs(tokens, name, macroDeclaration.limbs, false)
        let metadata: Metadata = { src: tokens.src, span: [nameToken.metadata.span[0], limbsMetadata.span[1]] }
        
        return this.makeMacro( 
            name, 
            body, 
            head, 
            limbs,
            metadata,
        )
    }

    private parseInlineMacro(tokens: TokenStream) {
        let nameToken = tokens.expect(TokenKind.IDENTIFIER)
        let name = nameToken.value
        let macroDeclaration = this.macros[name]

        let [head, headMetadata]: [AST[], Metadata] = tokens.is(TokenKind.LEFT_PAR) 
            ? this.parseEnclosedExpressionSequence(TokenKind.LEFT_PAR, TokenKind.RIGHT_PAR, tokens)
            : canStartExpression(tokens.peak()) ? (() => { let ast = this.parseExpression(tokens); return [[ast], ast.metadata] })()
            : [[], { src: tokens.src, span: [tokens.loc(), tokens.loc()] }]
        
        if (tokens.is(TokenKind.LEFT_CBRACKET)) throwWith(tokens.peak().metadata, "Inline macros don't expect a body.")
        
        this.checkMacroArity(headMetadata, name, head.length)

        let [limbs, limbsMetadata] = this.parseMacroLimbs(tokens, name, macroDeclaration.limbs, true)
        let metadata: Metadata = { src: tokens.src, span: [nameToken.metadata.span[0], limbsMetadata.span[1]] }

        return this.makeMacro(
            name,
            [],
            head,
            limbs,
            metadata,
        )
    }

    private parseDeclarativeMacro(tokens: TokenStream): AST {
        let nameToken = tokens.expect(TokenKind.IDENTIFIER)
        let name = nameToken.value
        let binding = this.makeLiteral(tokens.expect(TokenKind.IDENTIFIER))

        let [head, headMetadata]: [AST[], Metadata] = tokens.is(TokenKind.LEFT_PAR)
            ? this.parseEnclosedExpressionSequence(TokenKind.LEFT_PAR, TokenKind.RIGHT_PAR, tokens)
            : [[], { src: tokens.src, span: [tokens.loc(), tokens.loc()] }]
        head = [binding, ...head]
        this.checkMacroArity(headMetadata, name, head.length)

        let limbs = this.parseMacroLimbs(tokens, name, this.macros[name].limbs, true)[0]
        let [body, bodyMetadata] = this.parseEnclosedExpressionSequence(TokenKind.LEFT_CBRACKET, TokenKind.RIGHT_CBRACKET, tokens)
        let metadata: Metadata = { src: tokens.src, span: [nameToken.metadata.span[0], bodyMetadata.span[1]] }

        return this.makeMacro(
            name,
            body,
            head,
            limbs,
            metadata
        )
    }

    private parseMacroLimbs(tokens: TokenStream, name: string, limbs: string[], inline: boolean): [Dictionary<AST[]>, Metadata] {
        let limbsASTs: Dictionary<AST[]> = {}

        let limbsIndex = 0
        let begin = tokens.loc()
        let end = tokens.loc()
        while (tokens.is(TokenKind.IDENTIFIER)) {
            let limbNameToken = tokens.next()
            let limbName = limbNameToken.value

            while (limbsIndex < limbs.length && limbs[limbsIndex] !== limbName) limbsIndex++
            if (limbsIndex === limbs.length) {
                let metadata = limbNameToken.metadata
                if (limbs.includes(limbName)) throwWith(metadata, `Limb '${limbName}' was not at its place.`)
                else throwWith(metadata, `Macro '${name}' does not have a '${limbName}' limb. Perhaps you forgot a semicolon ?`)
            } else limbsIndex++
            
            if (tokens.is(TokenKind.LEFT_CBRACKET) && !inline) {
                let [exprs, metadata] = this.parseEnclosedExpressionSequence(TokenKind.LEFT_CBRACKET, TokenKind.RIGHT_CBRACKET, tokens)
                limbsASTs[limbName] = exprs
                end = metadata.span[1]
            } else {
                let expr = this.parseExpression(tokens)
                limbsASTs[limbName] = [expr]
                end = expr.metadata.span[1]
            }
        }

        return [limbsASTs, { src: tokens.src, span: [begin, end] }]
    }

    private parseSilentMacro(tokens: TokenStream): AST {
        let [body, metadata] = this.parseEnclosedExpressionSequence(TokenKind.LEFT_CBRACKET, TokenKind.RIGHT_CBRACKET, tokens)
        return this.makeMacro("", body, [], {}, metadata)
    }

    private parseParenthesizedExpression(tokens: TokenStream): AST {
        let begin = tokens.expect(TokenKind.LEFT_PAR).metadata.span[0]
        let end = begin
        let { tupleOp } = MicroParser

        if (tokens.is(TokenKind.RIGHT_PAR)) {
            end = tokens.next().metadata.span[1]
            return this.makeOperation(tupleOp, [], { src: tokens.src, span: [begin, end] })
        }

        let ast = this.parseExpression(tokens)

        if (tokens.is(TokenKind.SEMICOLON)) {
            tokens.next()
            let args = this.parseExpressionSequence(tokens, TokenKind.RIGHT_PAR)
            end = tokens.expect(TokenKind.RIGHT_PAR).metadata.span[1]
            return this.makeOperation(tupleOp, [ast, ...args], { src: tokens.src, span: [begin, end] })
        }
        
        tokens.expect(TokenKind.RIGHT_PAR)
        return ast
    }
    
    private parseExplicitPack(tokens: TokenStream): AST {
        let begin = tokens.expect(TokenKind.LEFT_BRACKET).metadata.span[0]
        let operator = tokens.is(TokenKind.OPERATOR) ? tokens.next().value : MicroParser.listOp
        let operands = this.parseExpressionSequence(tokens, TokenKind.RIGHT_BRACKET)
        let end = tokens.expect(TokenKind.RIGHT_BRACKET).metadata.span[1]

        return this.makeOperation(operator, operands, { src: tokens.src, span: [begin, end] })
    }

    private parseUnaryOrNullaryOperation(tokens: TokenStream): AST {
        let operatorToken = tokens.expect(TokenKind.OPERATOR)
        let operator = operatorToken.value
        let begin = operatorToken.metadata.span[0]
        let operands: AST[]
        let end: number

        if (!(operator in this.operators)) throwWith(operatorToken.metadata, `Unknown operator ${operator}.`)
        if (canStartExpression(tokens.peak())) {
            let operand = this.parseExpression(tokens, this.operators[operator].precedence)
            operands = [operand]
            end = operand.metadata.span[1]
        } else {
            operands = []
            end = operatorToken.metadata.span[1]
        }

        return this.makeOperation(operator, operands, { src: tokens.src, span: [begin, end] })
    }
    
    private parseExpression(tokens: TokenStream, minPrecedance: number = 0): AST {
        let { callOp, indexOp } = MicroParser
        let leftSide = this.parseOperand(tokens)
 
        while (true) {
            if (tokens.is(TokenKind.OPERATOR)) {
                let op = tokens.peak().value
                this.checkOperatorExists(op, tokens.peak().metadata)
                if (this.operators[op].precedence <= minPrecedance) break 
                tokens.next()

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

            } else if (tokens.is(TokenKind.LEFT_PAR)) {
                this.checkOperatorExists(callOp, tokens.peak().metadata)
                if (this.operators[callOp].precedence <= minPrecedance) break

                let [args, argsMetadata] = this.parseEnclosedExpressionSequence(TokenKind.LEFT_PAR, TokenKind.RIGHT_PAR, tokens)
                let metadata: Metadata = { src: tokens.src, span: [leftSide.metadata.span[0], argsMetadata.span[1]] }
                leftSide = this.makeOperation(callOp, [leftSide, ...args], metadata)

            } else if (tokens.is(TokenKind.LEFT_BRACKET)) {
                this.checkOperatorExists(indexOp, tokens.peak().metadata)
                if (this.operators[indexOp].precedence <= minPrecedance) break

                let [args, argsMetadata] = this.parseEnclosedExpressionSequence(TokenKind.LEFT_BRACKET, TokenKind.RIGHT_BRACKET, tokens)
                let metadata: Metadata = { src: tokens.src, span: [leftSide.metadata.span[0], argsMetadata.span[1]] }
                leftSide = this.makeOperation(indexOp, [leftSide, ...args], metadata)

            } else {
                break
            }
        }

        return leftSide
    }

    private parseOperand(tokens: TokenStream): AST {
        let token = tokens.peak()
        switch (token.kind) {
            case TokenKind.QUOTE: return this.parseString(tokens)
            case TokenKind.IDENTIFIER: return this.parseNameOrMacro(tokens)
            case TokenKind.NUMBER: return this.parseNumber(tokens)
            case TokenKind.OPERATOR: return this.parseUnaryOrNullaryOperation(tokens)
            case TokenKind.LEFT_PAR: return this.parseParenthesizedExpression(tokens)
            case TokenKind.LEFT_BRACKET: return this.parseExplicitPack(tokens)
            case TokenKind.LEFT_CBRACKET: return this.parseSilentMacro(tokens)
            case TokenKind.TICK: return this.parseLiteral(tokens)
            default: throwWith(tokens.peak().metadata, `An expression was expected, found '${token.value}'.`)
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
            name: "script",
            metadata: { src, span: [0, src.length-1] },
            body,
            head: scriptArgs.map(arg => { return { type: "literal", value: arg, metadata: { src, span: [0,0] } } }),
            limbs: {}
        }
    }
}


