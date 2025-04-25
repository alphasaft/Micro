# Micro

Micro is a small library for creating, parsing and interpreting languages fitting your requirements in a matter of minutes. Micro scripts are all based on the same generic yet very polymorpheous syntax that you can adapt to your situation ; it then allows you to quickly parse that language to generate usable JS values out of it. It aims at adressing the need for user-friendly, highly domain specific languages (DSLs), where using javascript or another mainstream language would lead to a lot of boilerplate and/or obfuscated code. 

The tool itself is written in Typescript, but knowing Javascript is, as per Typescript's design, sufficient to use it.

## Principle

Implementing a version of the Micro language is pretty straightforward :
1. You declare the operators and macros in the parser.
2. You implement said operators and macros as reducers in the transformer.
3. Optionally, you write some "compile-time" checks to ensure safety and correctness.

Then you can run whatever Micro script that conforms to the expected syntax. Said syntax is thoroughly described in the Micro syntax reference, so we won't double down on that here ; I suggest you read it first to get a glance at what Micro has to offer, then come back here. Once you're done, let's get started !

## Operator & macro declarations

First, import the `MicroParser` class, subclass it, and write the following code :

```js
import { MicroParser } from "./micro/parser";

// Everything is duly documented if needed, go read the docs if something is unclear.
class DemoParser extends MicroParser {
    constructor() {
        super({
            // Declarations go here 
            operators: [
                [{ name: "#number", arity: 1 }]
                [{ name: "*", arity: 2 }, { name: "/", arity: 2 }],
                [{ name: "+", arity: 2 }, { name: "-", arity: 2 }],
            ],
            macros: [
                { name: "if", arity: 1, limbs: ["else"] }
            ],
        })
    }
}
```

The operator declarations are the thing passed under the `operator` field. It's a list of lists of `OpDeclaration`s, with precedence modelled by how high they stand. So here, putting aside `#number` for now :

- We declare four operators : `*`, `/`, `*`, `-`.
- Every one of them has and arity of 2, meaning they take two operands to work with. 
- Because of how high they stand in the outer list relative to each other, `*` and `/` have the same precedence, which is higher that the precedence of `+` and `-`.

Concretely, this means that those four will be the only authorized operators and that the parser will check that each time they appear in a script, they are being passed exactly two operands. Macro declarations work the exact same way : Here, we declare an `if` macro, that takes in one single argument, and allows an `else` limb to be appened to it. 

Back to `#number`, now. As you might have already seen, `#number` is a special operator that Micro uses to handle number literals.
It isn't intended to be called explicitely in-script, so its relative precedence doesn't really matter. By convention, it's put at the top
of the operator declarations, along with `#string` and `#name` if present.

You now can parse whatever (well-formed) script you want using `parser.parse(src)` :

```js
let parser = new DemoParser();
let ast = parser.parse(`
    1+2*3-4;
    6*7;
    if (0) {
        3+4;
    };
`)
```

We'll import `printAST` to pretty-print the result of our parsing :

```js
import { printAst } from "./micro/ast"

// -- snip --
printAst(ast)
```

The output should be something like this :

```
<script>(...)
    -
        +
            #number
                `1`
            *
                #number
                    `2`
                #number
                    `3`
        #number
            `4`

    *
        #number
            `6`
        #number
            `7`
    
    if (...)
        +
            #number
                `3`
            #number
                `4`
```

What you're seeing here is an Abstract Syntactic Tree (or AST for short). It's an internal representation of the script that was just
parsed. It doesn't do much on its own, but Micro provides the tools we need to execute it.

## Running an AST

Next, let's import the `MicroTransformer` class, and also subclass it :

```js
// Why our derived class is called Runner when the base one is Transformer will become clear later on.
class DemoRunner extends MicroTransformer {
    lift = l => l

    reducer = ({$}, { body }) => {
        for (let stmt of body) {
            $(stmt)
        }

        return 0
    }
}
```

This is where the logic goes (i.e the semantics of the language we're creating). There are two important things here :

* The `reducer` : this is the core of our `DemoRunner`. It takes two arguments, the first being a `Context` and the second the `AST` to reduce, which is the one we printed earlier. Here, we pattern match to get the `$` (read "evaluate") attribute of the context, as well as the `body` of our `AST`. Then, iterate through each statement of our script, which also are `AST`s, to evaluate it. Finally, we return 0 to indicate everything went alright.

* The `lift` : While very simple in its implementation, the concept of `lift` is a bit complex, so we'll come back to it later.

So, are we done ? Well, not exactly. The reason for that is that we tell our `Runner` to evaluate each statement using `$`, but the `Runner` has no idea how to do that, in the same way that it didn't know how to run a script. We'll have to figure it out for it.

To do so, we also need to provide reducers for the operators and macros themselves. First, we need to write such reducers, and then to pass them down to `$` :

```js
class DemoRunner extends MicroTransformer {
    lift = s => s

    plusReducer = ([a,b]) => a+b
    minusReducer = ([a,b]) => a-b
    timesReducer = ([a,b]) => a*b
    divReducer = ([a,b]) => a/b
    numberReducer = parseFloat

    ifReducer = ({$}, { body, head: [condition] }) => {
        if ($(condition)) {
            for (let statement of body) {
                $(body)
            }
        }
    }

    reducer = ({$}, { body }) => {
        let opReducers = {
            "+": this.plusReducer,
            "-": this.minusReducer,
            "*": this.timesReducer,
            "/": this.divReducer,
            "#number": this.numberReducer
        }

        let macroReducers = {
            "if": this.ifReducer
        }

        for (let stmt of body) {
            $(stmt, opReducers, macroReducers)
        }

        return 0
    }
}
```

There's a lot going on here, so bear with me. Here, we :

* Wrote our reducers. Nothing really new here : + adds, - substracts, etc. 
* Passed them all down to `$` along with `stmt`. What it means is "Okay, knowing that + must be reduced like this, - like that, etc, please evaluate `stmt`."

Now, I would like to point out the specific forms the reducers take. Operator reducers are by far the simplest ones. They take their arguments as a list, then do stuff with it and return a result. Note that they don't need to evaluate anything using `$` : under the hood, our `Runner` automatically `$`s every operand, so that you don't have to do it yourself. This is because while a script must be able to decide what to evaluate and when to do so, an operator always takes in some values and outputs another one. 

Our single `if` macro reducer, on the other hand, looks exactly like our global script reducer, and this is because these two are the exact same thing : the script really is just one big macro, named `<script>` (that's why `printAST` displayed it in the same way as `if`), and the script reducer is nothing more than a plain macro reducer. 

Here, `head` refers to the arguments passed to `if`. Since `if` has its arity declared as one, we know it must be a singleton list whose sole item is the condition, so we can pattern match to obtain it, then evaluate it using `$` and act accordingly. Also, its worth noting that we declared `if` with an `else` limb, meaning we could write something like this :

```
if (0) {
    ...
} else {
    ...
}
```

We can update our `if` reducer to the following to take that into account :

```js
class DemoRunner extends MicroTransformer {
    // -- snip --
    
    ifReducer = ({$}, { body, head: [condition], limbs: { "else": elseLimb } }) => {
        if ($(condition)) {
            for (let stmt of body) {
                $(stmt)
            }
        } else {
            for (let stmt of elseLimb) {
                $(stmt)
            }
        }
    }
}
```

And then we can run a script like that :

```js
import { MicroCompiler } from "./micro/compiler";

class DemoCompiler extends MicroCompiler {
    parser = new DemoParser
    runner = new DemoRunner
}

let compiler = new DemoCompiler
let script = `...`
compiler.compile(script)
```


### Scoping

Note that we did not pass additionnal operator reducers to `$` inside `if`, and that's because it inherits any macro or operator reducer that was already passed outside. Since `<script>` wraps `if`, and that the script reducer passes all the necessary reducers, it is unnecessary to pass them once again. Still, should you do that, it would simply override the outside (we say "ambient") implementations. 

Speaking of ambient implementations, if you'd like to not completely override, but rather modify the behavior of an operator or a macro, you can use the first argument of the reducer. For instance, should you write a `verbose` macro that prints `Performing an addition !` whenever two things are added within its body, here's what you would write :

```js
// Here, we use the ambient `operators` field of the context ;
// there's also a `macros` one if you need it.
verboseReducer = ({ $, operators }, { body }) => {
    let ambientPlus = operators["+"]
    let modifiedPlus = ([a,b]) => {
        console.log("Performing an addition !")
        return ambientPlus([a,b])
    }

    for (stmt of body) {
        $(stmt, { "+": modifiedPlus })
    }
}
```

Here, we supply a new version of `+` through `modifiedPlus`, so we override the old one ; however, inside the `modifiedPlus` implementation, we return `ambientPlus([a,b])`, meaning that we delegate the actual implementation operator to whatever is the surrounding one. Generally speaking, this is a good practice, since this forbidds nested macros to interfere with one another. Here, should you nest two `verbose` blocks inside another, you'd get two `Performing an addition !` whenever + is called, which is the expected behavior. Also, if you try to delegate to a non-existing implementation (for example, calling an ambient macro implementation in the global reducer), the default behavior of the Runner is to crash.


### The lift function

Finally, let's come back to `lift`. When the parser encounters a number literal, say `0`, it generates an `AST` corresponding to the application of the operator `#number` to the literal (a plain string) ``` `0` ```. Now, when we ask it to actually evaluate that number, it will attempt to call the `numberReducer` we wrote earlier. What should its argument be ? Sure, it could pass the string `"0"` directly, but that would be assuming we agreed on that, which we didn't. Maybe the values we're passing around are actually `[type, value]` couples, because we do not want to accidentaly add a string and a number together. 

The workaround Micro adopts is to use a `lift` function, which lifts, or promotes, a literal string to a usable value. Taking back our `[type, value]` example, we could have written something like :

```
lift = literal => ["literal", literal]
```

so that plain, untyped literal strings do not run freely in our program. Here, that's not how we chose to proceed : we only manipulate numbers, so adding a `type` info would be superfluous. Hence, we just return the literal as is, knowing that it will be parsed into `#number` no matter what.

### A quick word about literals and literal operators

Just to mention a simple trick you can implement with the `#name` operator. These are the identifier counterpart to numbers : when `0` is encountered, you get ```#number `0` ``` ; when `myVariable` is encountered, you get ```#name `myVariable` ```. 

Earlier, we wrote `if (0) { ... }` to forbid a block to execute. That works, but it's not very good-looking. We could create a nullary `[#false]` operator, but that does also feel off. However, here's a third option :

```js
nameReducer = ([nameLiteral]) => {
    switch (nameLiteral) {
        case "true": return true;
        case "false": return false;
        default: ...
    }
}
``` 

Here, default could be anything : throwing, or actually implementing variables with, say, a `HashMap`. What's important is the fact `#name` allows for fine-grained control over identifiers, so that you can actually treat `true`, `false`, or whichever similar keyword-like value really, separately from the rest. That idea of controlling which literals do what can also be put applied to `#number` ; for instance, you could forbid floating point numbers by throwing if a dot is encountered in a `#number` literal.

### Handling ternary operators

Let's write a script that adds three zeroes together :

```
0+0+0
```

This will crash, actually, because this is understood as applying `+` to three operands at a time, where `+` has an arity of `2` only. The fix is as follows : first, we have to change `+`'s arity : 

```js
import { twoOrMore } from "./micro/parser"

// -- snip --

// twoOrMore is actually just [2, Infinity], but it's provided for the sake of lisibility.
{ name: "+", arity: twoOrMore }
```

Then, we have to change our reducer :

```js
plusReducer = args => args.reduce((a,b) => a+b)
```

What we're implicitely saying here is that `+` is left-associative, because reduce starts with the leftmost item of the array, so here's we're doing `0+0+0 => (0+0)+0`. There's a shortcut provided by Micro for that :

```js
// Left Associative Reducer
plusReducer = lar((a,b) => a+b)
```

Should you want a right-associative operator, there's `lar`'s counterpart, `rar`. If your operator is neither left, nor right associative, then you'll have to write it by yourself.

## Preprocessors

Sometimes, you'll want to enforce some syntactic rules before the script even runs. Hence, you need something that checks the AST after the parser, but before the runner. For that, we have preprocessors. They are some additionnal `MicroTransformer` we can specify in the corresponding field of our compiler :

```js
class DemoCompiler extends MicroCompiler {
    parser = new DemoParser

    // The preprocessors will be ran in the supplied order.
    preprocessors = [preproc1, preproc2]
    
    runner = new DemoRunner
}
```

Each Preprocessor works exactly like a Runner, except instead of having to output a usable JS value, you need to produce another, reviewed `AST`. This can be done with the helper functions in `./micro/ast` ; I recommand you check them out. 
