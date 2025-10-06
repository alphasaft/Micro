import { Metadata, summarize } from "./metadata"


export enum MicroTokenKind {
    SEMICOLON = ';',
    TICK = "'",
    QUOTE = '"',

    LEFT_PAR = '(',
    RIGHT_PAR = ')',
    LEFT_BRACKET = '[',
    RIGHT_BRACKET = ']',
    LEFT_CBRACKET = '{',
    RIGHT_CBRACKET = '}',
    
    OPERATOR = "operator",
    IDENTIFIER = "identifier",
    NUMBER = "number",

    UNKNOWN = "unknown character",
    EOF = "end of file",
}


export type MicroToken = { kind: MicroTokenKind, value: string, metadata: Metadata }

export function canStartExpression(token: MicroToken) {
    switch (token.kind) {
        case MicroTokenKind.LEFT_PAR:
        case MicroTokenKind.LEFT_BRACKET:
        case MicroTokenKind.LEFT_CBRACKET:
        case MicroTokenKind.OPERATOR:
        case MicroTokenKind.IDENTIFIER:
        case MicroTokenKind.NUMBER:
        case MicroTokenKind.TICK:
        case MicroTokenKind.QUOTE:
            return true
        default:
            return false
    }
}

export class TokenStream {
    private i: number

    constructor(public src: string, private storage: MicroToken[]) {
        this.i = 0
    }

    private eof(): MicroToken {
        return { kind: MicroTokenKind.EOF, value: "", metadata: { src: this.src, span: [this.src.length, this.src.length] } }
    }

    is(kind: MicroTokenKind) {
        return this.peak().kind === kind
    }

    expect(kind: MicroTokenKind) {
        let token = this.next()
        if (token.kind !== kind) throw summarize(token.metadata) + ` : ${kind} expected, got ${token.kind}.`
        return token
    }

    peak(): MicroToken { 
        return this.storage.length > this.i ? this.storage[this.i] : this.eof()
    }

    next() {
        return this.storage.length > this.i ? this.storage[this.i++] : this.eof()
    }
    
    loc() {
        return this.peak().metadata.span[0]
    }

    lastloc() {
        return this.storage[this.i > 0 ? this.i-1 : 0].metadata.span[1]
    }
}


export class MicroLexer {
    
    private static readonly INLINE_COMMENT_START = "##"
    private static readonly COMMENT_START = "#-"
    private static readonly COMMENT_END = "-#"
    private static readonly WHITESPACE_CHARS = "\n\t\r "
    private static readonly OPERATOR_CHARS = "&|~^@=+-*%!$/:.,?!<>"

    private static readonly CONTROL = {
        "'": MicroTokenKind.TICK,
        ';': MicroTokenKind.SEMICOLON,
        '(': MicroTokenKind.LEFT_PAR,
        ')': MicroTokenKind.RIGHT_PAR,
        '[': MicroTokenKind.LEFT_BRACKET,
        ']': MicroTokenKind.RIGHT_BRACKET,
        '{': MicroTokenKind.LEFT_CBRACKET,
        '}': MicroTokenKind.RIGHT_CBRACKET,
        '"': MicroTokenKind.QUOTE,
    }

    
    private isEOF(src: string, i: number) {
        return i >= src.length || src[i] === '\0'
    }

    private isWhitespace(src: string, i: number) {
        return !this.isEOF(src, i) && MicroLexer.WHITESPACE_CHARS.includes(src[i])
    }
    
    private isSymbolicOperatorChar(src: string, i: number) {
        return !this.isEOF(src, i) && MicroLexer.OPERATOR_CHARS.includes(src[i])
    }
    
    private isLetter(src: string, i: number) {
        return !this.isEOF(src, i) && (src[i].toLowerCase() !== src[i].toUpperCase() || src[i] === "_")
    }

    private isNumber(src: string, i: number) {
        return !this.isEOF(src, i) && !isNaN(parseInt(src[i]))
    }

    private isOperatorFirstChar(src: string, i: number) {
        return (
            !this.isEOF(src, i) && 
            ((src[i] === '#' && i+1 < src.length && this.isLetter(src, i+1)) || this.isSymbolicOperatorChar(src, i))
        )
    }

    private flush(src: string, i: number): number {
        let j = i
        let { COMMENT_START, COMMENT_END, INLINE_COMMENT_START } = MicroLexer

        if (src.substring(j, j+2) === COMMENT_START) {
            let depth = 0
            do {
                if (this.isEOF(src, j)) throw "Unclosed comment."
                switch (src.substring(j, j+2)) {
                    case COMMENT_START: j += 2; depth++; break
                    case COMMENT_END: j += 2; depth--; break
                    default: j++
                }
            } while (depth > 0)
        } 
        else if (src.substring(j,j+2) === INLINE_COMMENT_START) { while (src[j] !== '\n') j++; j++ }
        else while (this.isWhitespace(src, j)) j++

        return j-i > 0 ? this.flush(src, j) : j
    }

    /** 
     * Tokenizes src into a TokenStream.
     * This method is reserved for internal use : directly parse `src` using a MicroParser instead.
     */
    tokenize(src: string): TokenStream {
        let i = 0
        let tokens: MicroToken[] = []
        while (true) {
            i = this.flush(src, i)
            if (i >= src.length) return new TokenStream(src, tokens)

            let token = 
                  this.isOperatorFirstChar(src, i)          ? this.makeOperatorToken(src, i)
                : this.isLetter(src, i) || src[i] === "`"   ? this.makeNameToken(src, i)
                : this.isNumber(src, i)                     ? this.makeNumberToken(src, i)
                : src[i] in MicroLexer.CONTROL              ? this.makeControlToken(src, i)
                :                                             this.makeUnknownToken(src, i)
            
            i = token.metadata.span[1]
            tokens.push(token)
        }
    }

    private makeToken(kind: MicroTokenKind, src: string, i: number, j: number): MicroToken {
        return { kind, value: src.substring(i, j), metadata: { src, span: [i,j] } }
    }

    private makeOperatorToken(src: string, i: number): MicroToken {
        let j = i
        if (src[j] === '#') {
            j++
            while (this.isLetter(src, j)) j++
        } else {
            while (this.isSymbolicOperatorChar(src, j)) j++
        }
        return this.makeToken(MicroTokenKind.OPERATOR, src, i, j)
    }

    private makeNameToken(src: string, i: number): MicroToken {
        let j = i
        if (src[j] === "`") {
            j++
            while (src[j] !== "`") j++
            return { kind: MicroTokenKind.IDENTIFIER, value: src.substring(i+1, j), metadata: { src, span: [i,j+1] } }
        } else {    
            while (this.isLetter(src, j)) j++
            return this.makeToken(MicroTokenKind.IDENTIFIER, src, i, j)
        }
    }

    private makeNumberToken(src: string, i: number): MicroToken {
        let j = i
        while (this.isNumber(src, j)) j++
        if (src[j] === '.') j++
        while (this.isNumber(src, j)) j++
        return this.makeToken(MicroTokenKind.NUMBER, src, i, j)
    }

    private makeControlToken(src: string, i: number): MicroToken {
        let char = src[i] as keyof typeof MicroLexer.CONTROL
        return this.makeToken(MicroLexer.CONTROL[char], src, i, i+1)
    }

    private makeUnknownToken(src: string, i: number): MicroToken {
        return this.makeToken(MicroTokenKind.UNKNOWN, src, i, i+1)
    }
}