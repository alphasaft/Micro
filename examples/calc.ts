/** 
 * This is the simplest example there is, corresponding to the first chapters of the README file. 
 * It defines a Micro language able to carry out computations based on arithmetic operators.
 * 
 * The spec is as follows : 
 * - It has **, *, /, +, - in that order, working on numbers like you would expect
 * - It implements a with macro with an arity of 1, working as follow : it takes its argument as its initial value,
 *   binds it to the name `value`, then evaluate its body statement by statement, updating `value` to match the result of
 *   evaluating that statement. It then returns `value`.For example, with (1) { value+1; 3*value } would yield 3*(1+1) = 6.
 * - The script returns the result of every statement in a list.
*/

import { MicroCompiler } from "../src/compiler";
import { MacroDeclaration, MacroReducer } from "../src/macro";
import { OpDeclaration, OpReducer } from "../src/operator";
import { MapLike } from "../src/util";

/* 
Our operator declarations. Order is precedence (so ** has higher precedence than +, for example),
and two operators that are wrapped inside the same list have the same precedence (so * has same precedence than /).
Arity describes how many operands each operator takes.
*/
const opDeclarations: OpDeclaration[][] = [
    [{ name: "#number", arity: 1}, { name: "#name", arity: 1 }],
    [{ name: "**", arity: 2 }],
    [{ name: "*", arity: 2 }, { name: "/", arity: 2 }],
    [{ name: "+", arity: 2 }, { name: "-", arity: 2 }],
]


/*
Our macro declarations. We declare one single `with` macro with an arity of 1 (i.e takes one argument), 
which therefore must be used like this : with (value) { [[code here]] }
*/
const macroDeclarations: MacroDeclaration[] = [
    { name: "with", arity: 1 },
]


const scriptMacro: MacroReducer<any> = ({ ev }, body) => {
    /* 
    Our operators implementation. Pretty straightforward. We don't implement '#name'
    because only our with macro will use it, so we use the default implementation outside of 
    with macros (said implementation being throwing).
    */
    const ops: MapLike<OpReducer<any>> = {
        "#number": ([s]) => parseFloat(s),
        "**": ([x,y]) => x**y,
        "*": ([x,y]) => x*y,
        "/": ([x,y]) => x/y,
        "+": ([x,y]) => x+y,
        "-": ([x,y]) => x-y,
    }

    /*
    Our with macro implementation. What we want it to do is this : it takes its argument as its initial value,
    binds it to the name `value`, then evaluate its body statement by statement, updating `value` to match the result of
    evaluating that statement. It then returns `value`.
    */
    const macros: MapLike<MacroReducer<any>> = {
        "with": ({ ev, operators }, body, [initialValue]) => {
            /* Bind value to the sole argument of with */
            let value = ev(initialValue)

            /*
            Our name operator. If the name reads as "value", it returns the current value, else it delegates. 
            This is were delegating names implementation really shines !
            */
            let nameOp: OpReducer<any> = ([name]) => {
                switch (name) {
                    case "value": return value
                    case "default": return operators["#name"]([name])
                }
            }

            /** Evaluates the whole body */
            for (let expr of body) {
                value = ev(expr, { "#name": nameOp })
            }

            /** Returns the final value */
            return value
        }
    }

    /* The script macro just returns a list containing the result of every statement. */
    let result = []
    for (let expr of body) {
        result.push(ev(expr, ops, macros))
    }
    return result
}

/* We create our compiler. */
export let calcCompiler = new MicroCompiler<any>(
    opDeclarations,
    macroDeclarations,
    literal => literal,
    scriptMacro,
)

/* This should generate [3, 20.5, 12] (because 12 is ((4+8)*(4+8)-120)/2) when compiled. */
let src = `
    1+2;

    3*4+8.5;

    with (4) {
        value+8;
        value*value;
        (value-120)/2;
    };
`

/** Throws if the calc compiler misbehaves. */
export function calcTest() {
    let result = calcCompiler.compile(src)
    if (result.length !== 3) throw "Test failed."
    let [a,b,c] = result
    if (a !== 3 || b !== 20 || c !== 12) throw "Test failed."
}
