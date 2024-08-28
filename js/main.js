import { MicroCompiler } from "./compiler";
const nothing = "nothing";
const name = "name";
const literal = "literal";
const string = "string";
const number = "number";
const bool = "bool";
let create = (type, value) => ({ type, value });
let expect = (expected, { type, value }) => type === expected
    ? value
    : error(`Expected a value of type ${expected}, got ${type}`);
let error = (msg) => { throw msg; };
let numberFunc = f => (args) => create(number, f(args.map(x => expect(number, x))));
let printOp = args => {
    console.log(...args.map(arg => arg.value));
    return create(nothing, undefined);
};
let stringOp = ([s]) => {
    let source = expect(literal, s);
    return create(string, source);
};
let piOp = numberFunc(() => Math.PI);
let ltOp = args => {
    let correctArgs = args.map(arg => expect(number, arg));
    for (let i = 1; i < correctArgs.length; i++) {
        if (correctArgs[i - 1] > correctArgs[i]) {
            return create(bool, false);
        }
    }
    return create(bool, true);
};
let nameOp = ([value]) => {
    let l = expect(literal, value);
    switch (l) {
        case "true":
            return create(bool, true);
        case "false":
            return create(bool, false);
        default:
            return create(name, l);
    }
};
let callOp = ([f, arg]) => {
    var _a;
    let functionName = expect(name, f);
    let argValue = expect(number, arg);
    let functionImpl = (_a = {
        "sin": Math.sin,
        "cos": Math.cos,
        "exp": Math.exp
    }[functionName]) !== null && _a !== void 0 ? _a : error(`Unknown mathematical function ${functionName}.`);
    return create(number, functionImpl(argValue));
};
let throwOp = ([msg]) => {
    throw expect(string, msg);
};
let plusOp = numberFunc(([x, y]) => y === undefined ? x : x + y);
let minusOp = numberFunc(([x, y]) => y === undefined ? -x : x - y);
let timesOp = numberFunc(([x, y]) => x * y);
let divideOp = numberFunc(([x, y]) => x / y);
let numberOp = ([s]) => create(number, parseFloat(expect(literal, s)));
let ifMacro = ({ ev }, body, [condition]) => {
    let value = create(number, 0);
    if (expect(bool, ev(condition))) {
        for (let expr of body)
            value = ev(expr);
    }
    return value;
};
let chainMacro = ({ ev, operators }, body, [initialValue]) => {
    let ambientNameOp = operators["#name"];
    let nameOp = ([name]) => {
        if (expect(literal, name) === "value")
            return value;
        // Previously, an error was thrown, now we delegate.
        // Maybe the ambient #name will throw, maybe not, it's none of our business.
        else
            return ambientNameOp([name]);
    };
    let ops = { "#name": nameOp };
    let macros = {};
    let value = ev(initialValue);
    for (let expr of body) {
        value = ev(expr, ops, macros);
    }
    return value;
};
let scriptMacro = ({ ev }, body) => {
    let ops = {
        "#throw": throwOp,
        "#print": printOp,
        "+": plusOp,
        "-": minusOp,
        "*": timesOp,
        "/": divideOp,
        "#number": numberOp,
        "#name": nameOp,
        "#string": stringOp,
        "#call": callOp,
        "<=": ltOp,
        "#PI": piOp,
    };
    let macros = {
        "chain": chainMacro,
        "if": ifMacro,
    };
    body.forEach(expr => ev(expr, ops, macros));
    return create(nothing, undefined);
};
let compiler = new MicroCompiler([
    [
        { name: "#string", arity: 1 },
        { name: "#call", arity: 2 },
        { name: "#number", arity: 1 },
        { name: "#name", arity: 1 },
    ],
    [
        { name: "*", arity: 2 },
        { name: "/", arity: 2 }
    ],
    [
        { name: "+", arity: [1, 2] },
        { name: "-", arity: [1, 2] }
    ],
    { name: "<=", arity: [2, Infinity] },
    [{ name: "#print", arity: [0, Infinity] }, { name: "#throw", arity: 1 }],
    { name: "#PI", arity: 0 }
], [
    { name: "if", arity: 1 },
    { name: "chain", arity: 1 },
], literalValue => create(literal, literalValue), scriptMacro);
compiler.compile(`    
    #print 1*2+3; [[ This fortunately still works ]]
    2+0;

    [[ This demonstrates why infix pack notation is cool ]]
    [[ Here we test simultaneously 1 < 2 AND 2 < 3 ]]
    if ([1 <= 2 <= 3]) {
        #print cos([#PI]);
        #print (-3)*(-3) <= 10;
        #print chain(2) { 
            value*value; 
            value*value; 
            value*value;
            [[ This last statement leaves value unchanged, since that if will evaluate to 0. ]]
            value+if (true) { 1 };
        }
    };
    
    [[ Literals work perfectly ! ]]
    if (false) {
        [#print "This will never print because of "; false];
    }
`);
//# sourceMappingURL=main.js.map