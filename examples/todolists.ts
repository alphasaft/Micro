/**
 * This is the second of our example series. 
 * It's an actual implementation of the Micro language given at the beginning of the README.md,
 * that aims at describing todo lists and mostly uses concepts from the second chapter (operators) 
 * of that same file.
 * 
 * Its spec is :
 * - An implementation of #string (authorizing string formatting), #number and #name,
 * - A `todo` macro that has an arity of 1 and is used to declare todo lists,
 * - #normal, #important and #critical unary operators that should declare tasks inside those todo lists,
 * - A = operator to assign value to names, and an unary ? operator to query that value,
 * - An if macro,
 * - A ternary / operator that should be used in expressions such as [12/03/24] to declare dates,
 * - An nullary #today operator returning today's date,
 * - A <= operator that can compare dates together,
 * - An implementation of the #call operator allowing to translate UPPERCASE(str) to that same
 * string in upper case, and lowercase(str) to that same string in lower case.
 */

import { MicroCompiler } from "../src/compiler";
import { MacroDeclaration, MacroReducer } from "../src/macro";
import { OpDeclaration, OpReducer } from "../src/operator";
import { MapLike } from "../src/util";

/*
Op declarations. 
By convention, implicit operators (#name, #number, #string, #call, #index, and #bind (that last one will come later)) 
stand at the top, while nullary and ternary operators (for which precedence isn't used, since they always are wrapped
alone inside brackets) stand at the bottom.
*/
const opDeclarations: OpDeclaration[][] = [
    [{ name: "#name", arity: 1 }, { name: "#number", arity: 1 }, { name: "#string", arity: [1, Infinity] }, { name: "#call", arity: 2 }],
    [{ name: "?", arity: 1 }],
    [{ name: "<=", arity: [2, Infinity] }],
    [{ name: "=", arity: 2 }],
    [{ name: "#normal", arity: 1 }, { name: "#important", arity: 1 }, { name: "#critical", arity: 1 }],
    [{ name: "/", arity: 3 }, { name: "#today", arity: 0 }]
]

/* Macro declarations. */
const macroDeclarations: MacroDeclaration[] = [
    { name: "if", arity: 1 },
    { name: "todo", arity: 1 },
]

/* 
We are gonna manipulate many different objects, so instead of passing around untyped values 
recklessly, every value we will manipulate will be a { type: string, value: any } object,
with value being the actual value and type indicating what to expect (dynamic typing). 
We will use those two functions to help with that :
*/
type Value = { type: string, value: any }

function create(type: string, value: any) { 
    return { type, value } 
}

function expect(type: string, value: Value) { 
    if (type !== value.type) throw `Expected a ${type}, got a ${value.type}.`
    return value.value
}

/* And we'll declare some types for us to use */
const literal = "literal" // A literal, returned by the lift function
const name = "name" // A name, created with #name
const number = "number" // Speaks for itself
const string = "string" // Same
const bool = "bool" // Same...
const date = "date" // Represents a JS Date
const none = "none" // Represent a "missing value", returned by operators/macros that doesn't return, such as #important or if.
const todolists = "todolists" // Represent a list of todo lists. Only returned by the script macro.



type TODOListItem = { severity: string, description: string } 
type TODOList = { name: string, items: TODOListItem[] }

const scriptMacro: MacroReducer<Value> = ({ ev }, body) => {
    let todoLists: TODOList[] = []
    let variables: MapLike<Value> = {}

    // #normal, #important and #critical won't be implemented here (only inside the todo macro)
    const ops: MapLike<OpReducer<Value>> = {
        "#name": ([l]) => create(name, expect(literal, l)),

        "#number": ([l]) => {
            // We won't allow for floating point numbers in our scripts.
            // Here again, controlling exactly what numbers can be with #number is really swell.
            let unwrappedL = expect(literal, l)
            if (unwrappedL.includes('.')) throw "Floating point numbers are not allowed."
            return create(number, parseInt(expect(literal, l)))
        },

        // We accept string formatting and therefore must take in any number of arguments.
        // Every value is deemed valid here, EXCEPT values of type none.
        "#string": (args) => {
            return create(string, args.reduce((acc, arg) => {
                if (arg.type === "none") throw "Value expected."
                return acc + arg.value
            }, ""))
        },

        "#call": ([f, arg]) => {
            let unwrappedF = expect(name, f)
            let unwrappedArg = expect(string, arg)
            switch (unwrappedF) {
                case "UPPERCASE": return create(string, unwrappedArg.toUpperCase())
                case "lowercase": return create(string, unwrappedArg.toLowerCase())
                default: throw "No such function : '" + unwrappedF + "'."
            }
        },

        "?": ([variable]) => {
            let unwrappedVariable = expect(name, variable)
            if (!(unwrappedVariable in variables)) throw `Variable ${unwrappedVariable} was not yet declared.`
            return variables[unwrappedVariable]
        },
        
        "<=": (dates) => {
            let unwrappedDates = dates.map(d => expect(date, d))
            for (let i = 1; i<unwrappedDates.length; i++) {
                // Prefixing a date with '+' allows to convert it to a timestamp in JS
                // We can then compare those timestamps, effectively comparing the dates.
                if (+unwrappedDates[i-1] > +unwrappedDates[i]) {
                    return create(bool, false)
                }
            }
            return create(bool, true)
        },

        "=": ([variable, value]) => {
            let unwrappedVariable = expect(name, variable)
            variables[unwrappedVariable] = value
            return create(none, undefined)
        },

        "/": ([month, day, year]) => {
            let unwrappedMonth = expect(number, month), 
                unwrappedDay = expect(number, day),
                unwrappedYear = expect(number, year)

            return create(date, new Date(
                unwrappedYear < 100 ? 2000 + unwrappedYear : unwrappedYear,
                unwrappedMonth - 1, // Month should be comprised between 0 and 11, not 1 and 12
                unwrappedDay, 
            ))
        },

        "#today": () => {
            let now = new Date() 
            // We don't want to get the current date, but the date corresponding to that same day at 00:00 AM.
            return create(date, new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
            ))
        }
    }

    const macros: MapLike<MacroReducer<Value>> = {
        "if": ({ ev }, body, [condition]) => {
            if (expect(bool, ev(condition))) for (let expr of body) ev(expr)
            return create(none, undefined)
        },

        "todo": ({ ev }, body, [itemName]) => {
            let unwrappedItemName = expect(string, ev(itemName))
            let todolistItems: TODOListItem[] = []

            let createItem = (severity: string, description: string) => {
                todolistItems.push({ severity, description })
                return create(none, undefined)
            }

            let ops: MapLike<OpReducer<Value>> = {
                "#normal": ([itemDesc]) => createItem("normal", expect(string, itemDesc)),
                "#important": ([itemDesc]) => createItem("important", expect(string, itemDesc)),
                "#critical": ([itemDesc]) => createItem("critical", expect(string, itemDesc)),
            }

            /* We override the todo macro to forbid nested todo lists. */
            let macros: MapLike<MacroReducer<Value>> = {
                "todo": () => { throw "Nested todos are forbidden." }
            }

            for (let expr of body) {
                ev(expr, ops, macros)
            }

            todoLists.push({ name: unwrappedItemName, items: todolistItems })
            return create(none, undefined)
        }
    }

    for (let expr of body) {
        ev(expr, ops, macros)
    }

    return create(todolists, todoLists)
}

const compiler = new MicroCompiler(
    opDeclarations,
    macroDeclarations,
    l => create(literal, l),
    scriptMacro
)

const src = `
    todo("Everyday life") {
        #critical "Pay my taxes";
        #important "Clean my room";

        currentShow = "Monty Python";
        #normal "Watch {?currentShow} !";
    };

    if ([ [08/03/24] <= [#today] <= [08/30/24] ]) {
        todo("Holidays") {
            #normal "Towels";
            #critical UPPERCASE("Don't forget the keys !!!");
        };
    };
`

let lists = expect(todolists, compiler.compile(src))
for (let list of lists) {
    console.log(list)
}