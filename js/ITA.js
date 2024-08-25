function error(msg) {
    throw msg;
}
function between(a, b, x) {
    return a <= x && x <= b;
}
export class ITACompiler {
    constructor(evalLiteral, scriptMacro, operatorsPrecedence) {
        this.evalLiteral = evalLiteral;
        this.scriptMacro = scriptMacro;
        this.operatorsPrecedence = operatorsPrecedence;
    }
    isEOF(src, i) {
        return i >= src.length;
    }
    isSymbolicOperatorChar(src, i) {
        return !this.isEOF(src, i) && ITACompiler.OPERATOR_CHARS.includes(src[i]);
    }
    isWhitespace(src, i) {
        return !this.isEOF(src, i) && ITACompiler.WHITESPACE_CHARS.includes(src[i]);
    }
    isLetter(src, i) {
        return !this.isEOF(src, i) && src[i].toLowerCase() !== src[i].toUpperCase();
    }
    isNumber(src, i) {
        return !this.isEOF(src, i) && between(ITACompiler.zeroCC, ITACompiler.nineCC, src.charCodeAt(i));
    }
    flush(src, i) {
        let j = i;
        if (src.substring(j, j + 2) === "[[")
            while (src.substring(j, j + 1) !== "]]")
                j++;
        else
            while (this.isWhitespace(src, j))
                j++;
        return j - i > 0 ? this.flush(src, j) + j - i : j - i;
    }
    parseSymbolicOperator(src, i) {
        let j = i;
        while (this.isSymbolicOperatorChar(src, j))
            j++;
        return [src.substring(i, j), j - i];
    }
    parseTextualOperator(src, i) {
        let j = i + 1;
        while (this.isLetter(src, j))
            j++;
        return [src.substring(i, j), j - i];
    }
    parseLetters(src, i) {
        let j = i;
        while (this.isLetter(src, j))
            j++;
        return [src.substring(i, j), j - i];
    }
    parseString(src, i) {
        let j = i + 1 + this.flush(src, i + 1);
        while (src[j] !== '"')
            j++;
        j++;
        return [{ type: "operation", operator: "#string", operands: [{ type: "literal", value: src.substring(i, j - 1) }] }, j - i];
    }
    parseNumber(src, i) {
        let j = i;
        while (this.isNumber(src, j))
            j++;
        return [{ type: "operation", operator: "#number", operands: [{ type: "literal", value: src.substring(i, j) }] }, j - i];
    }
    parseExpressionSequence(src, i, start, sep, end) {
        let j = i;
        if (src[j] !== start)
            error(`'${start}' expected.`);
        j += 1 + this.flush(src, j + 1);
        let sequence = [];
        let done = src[j] === end;
        while (!done) {
            let [operand, consumed] = this.parseExpression(src, j);
            j += consumed + this.flush(src, j + consumed);
            let sepSeen = src[j] === sep;
            if (src[j] === sep)
                j += 1 + this.flush(src, j + 1);
            let endSeen = src[j] === end;
            if (src[j] === end) {
                done = true;
                j += 1 + this.flush(src, j + 1);
            }
            if (!(sepSeen || endSeen))
                error(`'${sep}' expected.`);
            j += 1 + this.flush(src, j + 1);
            sequence.push(operand);
        }
        j++;
        return [sequence, j - i];
    }
    parseName(src, i) {
        let [name, consumed] = this.parseLetters(src, i);
        return [this.makeName(name), consumed];
    }
    makeName(value) {
        return { type: "operation", operator: "#name", operands: [{ type: "literal", value }] };
    }
    parseMacroOrIdentifier(src, i) {
        let j = i + this.flush(src, i);
        let [name, consumed1] = this.parseLetters(src, j);
        j += consumed1 + this.flush(src, j + consumed1);
        let [boundTo, consumed2] = this.isLetter(src, j) ? this.parseName(src, j) : [null, 0];
        j += consumed2 + this.flush(src, j + consumed2);
        let [args, consumed3] = src[j] === '(' ? this.parseExpressionSequence(src, j, '(', ';', ')') : [null, 0];
        j += consumed3 + this.flush(src, j + consumed3);
        if (src[j] === '{') {
            let [body, consumed4] = this.parseExpressionSequence(src, j, '{', ';', '}');
            j += consumed4 + this.flush(src, j + consumed4);
            let limbs = {};
            while (this.isLetter(src, j)) {
                let [limbName, consumed5] = this.parseLetters(src, j);
                j += consumed5 + this.flush(src, j + consumed5);
                let [limb, consumed6] = this.parseExpressionSequence(src, j, '{', ';', '}');
                limbs[limbName] = limb;
                j += consumed6 + this.flush(src, j + consumed6);
            }
            return [
                boundTo !== null
                    ? {
                        type: "operation",
                        operator: "=",
                        operands: [
                            boundTo,
                            { type: "macro", macro: name, args: args !== null && args !== void 0 ? args : [], body, limbs }
                        ]
                    }
                    : { type: "macro", macro: name, args: args !== null && args !== void 0 ? args : [], body, limbs },
                j - i
            ];
        }
        if (boundTo !== null)
            error("Operator expected.");
        if (args !== null) {
            return [{ type: "operation", operator: "#call", operands: [this.makeName(name), ...args] }, j - i];
        }
        else {
            return [this.makeName(name), j - i];
        }
    }
    parseSilentMacro(src, i) {
        let [body, consumed] = this.parseExpressionSequence(src, i, '{', ';', '}');
        return [{ type: "macro", macro: "", args: [], body, limbs: {} }, consumed];
    }
    parseParenthesizedExpression(src, i) {
        let j = i + 1;
        j += this.flush(src, j);
        let [ast, consumed] = this.parseExpression(src, j);
        j += consumed + this.flush(src, j + consumed);
        if (src[j] !== ')')
            error("Closing parenthesis expected.");
        j++;
        return [ast, j - i];
    }
    parseBracketedExpression(src, i) {
        let j = i + 1;
        j += this.flush(src, j);
        return this.isOperatorFirstChar(src, j)
            ? this.parsePrefixBracketedExpression(src, i)
            : this.parseInfixBracketedExpression(src, i);
    }
    parsePrefixBracketedExpression(src, i) {
        let j = i + 1 + this.flush(src, i + 1);
        let [operator, consumed] = this.parseOperator(src, j);
        j += consumed + this.flush(src, j + consumed);
        let operands = [];
        while (src[j] !== ']') {
            let [operand, consumed] = this.parseOperand(src, j);
            j += consumed + this.flush(src, j + consumed);
            if (src[j] !== ';')
                error("';' expected.");
            operands.push(operand);
        }
        return [{ type: "operation", operator, operands }, j - i];
    }
    parseInfixBracketedExpression(src, i) {
        if (src[i] !== '[')
            error("Syntax error : Opening bracket expected.");
        let j = i + 1 + this.flush(src, i + 1);
        let [operatorands, consumed] = this.preparseOperands(src, j);
        j += consumed + this.flush(src, j + consumed);
        if (this.isExpressionFirstChar(src, j)) {
            let [trailingOperator, consumed] = this.parseOperator(src, j);
            j += consumed + this.flush(src, j + consumed);
            operatorands.push(trailingOperator);
        }
        if (src[j] !== ']')
            error("Syntax error : Closing bracket expected.");
        j++;
        if (operatorands.length < 2)
            error("Infix bracket expressions expect at least an operand and an operator.");
        let operator = operatorands[1];
        for (let i = 1; i < operatorands.length; i += 2) {
            if (operatorands[i] !== operator) {
                error("Syntax error : Only a single type of operator is allowed inside a bracket expression."
                    + "Enclose subexpressions in parentheses if needed.");
            }
        }
        let operands = [];
        for (let i = 0; i < operatorands.length; i += 2)
            operands.push(operatorands[i]);
        return [{ type: "operation", operator, operands }, j - i];
    }
    parseUnaryOperation(src, i) {
        let j = i + this.flush(src, i);
        let [operator, consumed1] = this.parseOperator(src, j);
        j += consumed1 + this.flush(src, j + consumed1);
        let [operand, consumed2] = this.parseOperand(src, j);
        j += consumed2 + this.flush(src, j + consumed2);
        return [{ type: "operation", operator, operands: [operand] }, j - i];
    }
    parseExpression(src, i) {
        let j = 0;
        j += this.flush(src, j);
        // Handle nullary operators.
        if (this.isOperatorFirstChar(src, j)) {
            let [op, consumed] = this.parseOperator(src, j);
            j += consumed;
            if (!this.isExpressionFirstChar(src, j))
                return [{ type: "operation", operator: op, operands: [] }, j - i];
        }
        let [operatorands, consumed] = this.preparseOperands(src, i);
        let precedences = this.operatorsPrecedence;
        function fold(operatorands) {
            if (operatorands.length === 1)
                return operatorands[0];
            let lowestPrecedenceIndex = 1;
            let lowestPrecedence = precedences[operatorands[1]];
            for (let i = 1; i < operatorands.length; i += 2) {
                let op = operatorands[i];
                let precedence = precedences[op];
                if (lowestPrecedence >= precedence) {
                    lowestPrecedence = precedence;
                    lowestPrecedenceIndex = i;
                }
            }
            return {
                type: "operation",
                operator: operatorands[lowestPrecedenceIndex],
                operands: [fold(operatorands.slice(0, lowestPrecedenceIndex)), fold(operatorands.slice(lowestPrecedenceIndex + 1))]
            };
        }
        return [fold(operatorands), consumed];
    }
    preparseOperands(src, i) {
        let operatorands = [];
        let j = i;
        j += this.flush(src, j);
        let [firstOperand, consumed] = this.parseOperand(src, j);
        j += consumed + this.flush(src, j + consumed);
        operatorands.push(firstOperand);
        while (this.isOperatorFirstChar(src, j)) {
            let [operator, consumed1] = this.parseOperator(src, j);
            if (!this.isExpressionFirstChar(src, j))
                break;
            else
                j += consumed1 + this.flush(src, j + consumed1);
            let [operand, consumed2] = this.parseOperand(src, j);
            j += consumed2 + this.flush(src, j + consumed2);
            operatorands.push(operator, operand);
        }
        return [operatorands, j - i];
    }
    isOperatorFirstChar(src, i) {
        return i < src.length && (src[i] === '#' || this.isSymbolicOperatorChar(src, i));
    }
    parseOperator(src, i) {
        if (this.isSymbolicOperatorChar(src, i))
            return this.parseSymbolicOperator(src, i);
        else
            return this.parseTextualOperator(src, i);
    }
    isExpressionFirstChar(src, i) {
        return i < src.length && this.isLetter(src, i) || this.isNumber(src, i) || this.isOperatorFirstChar(src, i) || "{([\"".includes(src[i]);
    }
    parseOperand(src, i) {
        let j = i + this.flush(src, i);
        let [operand, consumed] = this.isEOF(src, j) ? error("Unexpected end of file while parsing operand.")
            : this.isLetter(src, j) ? this.parseMacroOrIdentifier(src, j)
                : this.isOperatorFirstChar(src, j) ? this.parseUnaryOperation(src, j)
                    : this.isNumber(src, j) ? this.parseNumber(src, j)
                        : src[j] === '(' ? this.parseParenthesizedExpression(src, j)
                            : src[j] === '[' ? this.parseBracketedExpression(src, j)
                                : src[j] === '"' ? this.parseString(src, j)
                                    : src[j] === '{' ? this.parseSilentMacro(src, j)
                                        : error("Syntax error.");
        j += consumed + this.flush(src, j + consumed);
        while (src[j] === '(' || src[j] === '[') {
            let operator = { '(': "#call", '[': "#index" }[src[j]];
            let matchingEnd = { '(': ')', '[': ']' }[src[j]];
            let [args, consumed] = this.parseExpressionSequence(src, j, src[j], ';', matchingEnd);
            j += consumed + this.flush(src, j + consumed);
            operand = { type: "operation", operator, operands: [operand, ...args] };
        }
        return [operand, j - i];
    }
    parseScript(src, scriptArgs) {
        let [result, consumed] = this.parseMacroOrIdentifier(`script(${scriptArgs.map(s => `"${s}"`).join(', ')}) { ${src} };`, 0);
        if (consumed < src.length)
            error("End of file expected.");
        return result;
    }
    eval(ast, operators, macros) {
        switch (ast.type) {
            case "literal":
                return this.evalLiteral(ast.value);
            case "macro":
                let { macro, args, body, limbs } = ast;
                if (!(macro in macros))
                    error(`Macro '${macro}' not found.`);
                let evaluator = (ast2, operators2, macros2) => {
                    let fullOps = Object.assign(Object.assign({}, operators), operators2);
                    let fullMacros = Object.assign(Object.assign({}, macros), macros2);
                    return this.eval(ast, fullOps, fullMacros);
                };
                return macros[macro](args, body, limbs, evaluator);
            case "operation":
                let { operator, operands } = ast;
                if (!(operator in operators))
                    error(`Operator '${operator}' not found.`);
                let evaluatedOperands = operands.map(x => this.eval(x, operators, macros));
                return operators[operator](evaluatedOperands);
        }
    }
    compile(src, ...scriptArgs) {
        let ast = this.parseScript(src, scriptArgs);
        return this.eval(ast, {}, { script: this.scriptMacro });
    }
}
ITACompiler.WHITESPACE_CHARS = "\n\t ";
ITACompiler.OPERATOR_CHARS = "&|~`^@=+°$£*%!§/:.,?!<>";
ITACompiler.zeroCC = '0'.charCodeAt(0);
ITACompiler.nineCC = '9'.charCodeAt(0);
/*

[[ Comments are declared using double brackets. ]]
[[ Every script is implicitely wrapped inside a global script(...args) { ... } macro. ]]

[[ Hash identify textual operators. Here, it's parsed as applyOp(#import, ioStream). ]]
#import ioStream;

"You can combine operators and macros : here, we apply #export to the result yielded by the macro namespace.";
#export namespace {
    #item move;
};

"This is actually : [#bind A; class {}] with class being a macro (cool syntactic sugar !)";
class A {};

myInstance = #new myClass;

"Macros define operators inside their body : here, #break is a for-macro specific operator."
$for (i=0; i<10; #incr i) {
    "Nullary operators can't be used as operands ; they must be enclosed in parentheses, or used alone.";

    "Either so :";
    #break;

    "Or so :";
    tau = 2 * (#PI);
};

"This is an 'else' limb.";
if (true) { } else { };

movement move(a: number; b: vec) {
    #return (?b .* ?a) * ?timefrac;
};

func between(x; y; z) {
    "Chaining comparisons is cool, right ?";
    a = [x < y < z];
    "Another syntax :";
    b = [< x y z]
};


"This is a way of writing lists.";
list = [1, 2, 3];
"For single element list :";
list2 = [1,]
"For empty lists, you can do that :";
list3 = [,];

"We can be even more creative with a json-like DSL :";
json = {
    config: {
        version: 1;
        platform: "windows";
        keys: ["667HJE72JE9",];
        uniqueKeys: [#set "A"; "A"; "B"];  "This will yield a new Set() in JS."
    };
};

*/ 
//# sourceMappingURL=ITA.js.map