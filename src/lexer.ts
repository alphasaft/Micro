import { Metadata } from "./metadata"
import { between } from "./_util"

export enum MicroTokenKind {
    SEMICOLON,
    TICK,
    OPENING_PAR,
    CLOSING_PAR,
    OPENING_BRACKET,
    CLOSING_BRACKET,
    OPENING_CBRACKET,
    CLOSING_CBRACKET,
    OPERATOR,
    NAME,
    NUMBER,
    STRING,
    EOF,
}

export type MicroToken = { kind: MicroTokenKind, value: string, metadata: Metadata }

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
        if (token.kind !== kind) throw `${kind} expected.`
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
}


export class MicroLexer {
    
    private static readonly INLINE_COMMENT_START = "##"
    private static readonly COMMENT_START = "#-"
    private static readonly COMMENT_END = "-#"
    private static readonly WHITESPACE_CHARS = "\n\t "
    private static readonly OPERATOR_CHARS = "&|~^@=+-*%!§/:.,?!<>"
    private static readonly zeroCC = '0'.charCodeAt(0)
    private static readonly nineCC = '9'.charCodeAt(0)

    private static readonly CONTROL = {
        "'": MicroTokenKind.TICK,
        ';': MicroTokenKind.SEMICOLON,
        '(': MicroTokenKind.OPENING_PAR,
        ')': MicroTokenKind.CLOSING_PAR,
        '[': MicroTokenKind.OPENING_BRACKET,
        ']': MicroTokenKind.CLOSING_BRACKET,
        '{': MicroTokenKind.OPENING_CBRACKET,
        '}': MicroTokenKind.CLOSING_CBRACKET,
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
        return !this.isEOF(src, i) && between(MicroLexer.zeroCC, MicroLexer.nineCC, src.charCodeAt(i))
    }

    private isOperatorFirstChar(src: string, i: number) {
        return !this.isEOF(src, i) && (src[i] === '#' || this.isSymbolicOperatorChar(src, i))
    }

    private flush(src: string, i: number): number {
        let j = i
        let { COMMENT_START, COMMENT_END, INLINE_COMMENT_START } = MicroLexer

        if (src.substring(j, j+2) === COMMENT_START) {
            let depth = 0
            do {
                switch (src.substring(j, j+2)) {
                    case COMMENT_START: j += 2; depth++; break
                    case COMMENT_END: j += 2; depth--; break
                    default: j++
                }
                if (this.isEOF(src, j)) throw "Unclosed comment."
            } while (depth > 0)
        } 
        else if (src.substring(j,j+2) === INLINE_COMMENT_START) { while (src[j] !== '\n') j++; j++ }
        else while (this.isWhitespace(src, j)) j++

        return j-i > 0 ? this.flush(src, j) : j
    }

    /** 
     * Tokenizes src. This method is reserved for internal use : directly parse `src` using a MicroParser instead.
     */
    tokenize(src: string): TokenStream {
        let i = 0
        let tokens: MicroToken[] = []
        while (true) {
            i = this.flush(src, i)
            if (i >= src.length) return new TokenStream(src, tokens)

            let token = 
                  this.isOperatorFirstChar(src, i) ? this.makeOperatorToken(src, i)
                : this.isLetter(src, i)            ? this.makeNameToken(src, i)
                : this.isNumber(src, i)            ? this.makeNumberToken(src, i)
                : src[i] === '"'                   ? this.makeStringToken(src, i)  // Fix it
                : src[i] in MicroLexer.CONTROL     ? this.makeControlToken(src, i)
                : (() => { throw `Unknown character ${src[i]}.` })()
            
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
            if (!this.isLetter(src, j)) throw "'#' is not a valid operator."
            while (this.isLetter(src, j)) j++
        } else {
            while (this.isSymbolicOperatorChar(src, j)) j++
        }
        return this.makeToken(MicroTokenKind.OPERATOR, src, i, j)
    }

    private makeNameToken(src: string, i: number): MicroToken {
        let j = i
        while (this.isLetter(src, j)) j++
        return this.makeToken(MicroTokenKind.NAME, src, i, j)
    }

    private makeNumberToken(src: string, i: number): MicroToken {
        let j = i
        while (this.isNumber(src, j)) j++
        if (src[j] === '.') j++
        while (this.isNumber(src, j)) j++
        return this.makeToken(MicroTokenKind.NUMBER, src, i, j)
    }

    private makeStringToken(src: string, i: number): MicroToken {
        let j = i+1
        while (j < src.length && (src[j] !== "\"" || src[j-1] === "\\")) j++
        if (j === src.length) throw `Closing '"' expected.` 
        else j++
        return { kind: MicroTokenKind.STRING, value: src.substring(i+1,j-1), metadata: { src, span: [i,j] } }
    }

    private makeControlToken(src: string, i: number): MicroToken {
        let char = src[i] as keyof typeof MicroLexer.CONTROL
        return this.makeToken(MicroLexer.CONTROL[char], src, i, i+1)
    }
}