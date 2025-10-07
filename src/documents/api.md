# Micro

Micro is a small library for creating, parsing and interpreting languages fitting your requirements in a matter of minutes. Micro scripts are all based on the same generic yet very polymorpheous syntax that you can adapt to your situation ; it then allows you to quickly parse that language to generate usable JS values out of it. It aims at adressing the need for user-friendly, highly domain specific languages (DSLs), where using javascript or another mainstream language would lead to a lot of boilerplate and/or obfuscated code. 

The tool itself is written in Typescript, but knowing Javascript is, as per Typescript's design, sufficient to use it.

## Principle

Implementing a version of the Micro language is pretty straightforward :
1. You declare the operators and macros in the parser,
2. You implement said operators and macros in the reducer,
3. You optionally add checks to ensure script correctness.

Then you can run whatever Micro script that conforms to the expected syntax. Said syntax is thoroughly described in the Micro syntax reference, so we won't double down on that here ; I suggest you read it first to get a glance at what Micro has to offer, then come back here. Once you're done, let's get started !

## Operator & macro declarations

First, import the `MicroParser` class, subclass it, and write the following code :

```js
import { MicroParser } from "micro/parser";

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
                { name: "if", arity: 1, kind: "block", limbs: ["else"] }
            ],
        })
    }
}
```

The operator declarations are the thing passed under the `operator` field. It's a list of lists of `OpDeclaration`s, with precedence modelled by how high they stand. So here, putting aside `#number` for now :

- We declare four operators : `*`, `/`, `*`, `-`.
- Every one of them has and arity of 2, meaning they take two operands to work with. 
- Because of how high they stand in the outer list relative to each other, `*` and `/` have the same precedence, which is higher that the precedence of `+` and `-`.

Concretely, this means that those four will be the only authorized operators and that the parser will check that each time they appear in a script, they are being passed exactly two operands. Macro declarations work the same way : Here, we declare an `if` block macro, that takes in one single argument, and allows an `else` limb to be appended to it.

Back to `#number`, now. As you might have already seen in the syntax reference, `#number` is a special operator that Micro uses to handle number literals. It isn't intended to be called explicitely in-script, so its relative precedence doesn't really matter. By convention, it's put at the top of the operator declarations, along with `#string` and `#name` if present. If one of `#number`, `#name` or `#string` isn't present, then the corresponding literal type is disabled and its use forbidden in-script.

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

We'll import `printAst` to pretty-print the result of our parsing :

```js
import { printAst } from "micro/ast"

// -- snip --
printAst(ast)
```

The output should be something like this :

```
script(...)
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
parsed. It doesn't do much on its own, but Micro provides the tools we need to reduce it to a usable value.

## Reducing an AST

Let's import the `MicroReducer` class, and also subclass it :

```js
class DemoReducer extends MicroReducer {
    lift = l => l
    script = ({$}, { body }) => { for (let stmt of body) $(stmt) }
}
```

This is where the logic goes (i.e the semantics of the language we're creating). There are two important things here :


* The `script` function : this is the core of our `DemoReducer`. It takes two arguments, the first being a `Context` and the second the `AST` to reduce, which is the one we printed earlier. Here, we pattern match to get the `$` (read "evaluate") attribute of the `context`, as well as the `body` of our `AST`. Then, we iterate through each statement of our script, which also are `AST`s, to evaluate them sequentially. 
* The `lift` : While very simple in its implementation, the concept of `lift` is a bit complex, so we'll come back to it later.

So, are we done ? Well, not exactly. The reason for that is that we told our `DemoReducer` to evaluate each statement using `$`, but it has no idea how to do so, in the same way that it didn't know how to run a script. We'll have to figure it out for it.

To do so, we also need to provide reducers for the operators and macros themselves. To do that, we just need to write such reducers :

```js

class DemoReducer extends MicroReducer {
    lift = s => s;
    script = ({$}, { body }) => { 
        let operators = {
            '+': (a,b) => a+b;
            '-': (a,b) => a-b;
            '*': (a,b) => a*b;
            '/': (a,b) => a/b;
            '#number': l => parseFloat(l);
        }

        let macros = {
            'if': ({$}, { body, head: [condition] }) => {
                if ($(condition)) for (let statement of body) $(stmt)
            };
        }

        for (let stmt of body) {
            $(stmt, { operators, macros })
        } 
    }
}
```

There's a lot going on here, so bear with me for a second. First, we declare our operators and macros reducers with `let operators = { ... }` and `let macros = { ... }` - more about the details of *how* we're implementing them later. Then, we pass them to `$` when evaluating statements, that is we tell `$` "okay, knowing that operators are implemented this way and macros that way, do your job and evaluate my statement". And that's done !

Now, I would like to point out the specific forms the reducers take. Operator reducers are by far the simplest ones. They quite literally just do what you'd expect them to, like `+`, who is implemented with `(a,b) => a+b`. One thing of interest is that they take their arguments directly as JS values, not as `AST`s. Hence, you do not need to use `$` to evaluate anything, unlike within macro bodies.

Our single `if` macro reducer, on the other hand, looks exactly like our global script reducer, and this is because these two are the exact same thing : the script really is just one big macro named `script` (that's why `printAST` displayed it in the same way as `if`), and the script reducer is nothing more than a plain macro reducer. Here, `head` refers to the arguments passed to `if`. Since `if` has its arity declared as one, we know it must be a singleton list whose sole item is the condition, so we can pattern match to obtain it, then evaluate it using `$` and act accordingly.  Also, we declared `if` with an `else` limb, meaning we could write something like this :

```
if (0) {
    ...
} else {
    ...
}
```

We can update our `if` reducer to the following to take that into account :

```js
class DemoReducer extends MicroReducer {
    // -- snip --
    
    globaMacroReducers = {
        'if': ({$}, { body, head: [condition], limbs: { "else": elseLimb } }) => {
            if ($(condition)) for (let stmt of body) $(stmt)
            // Note elseLimb can be `undefined` if the else limb is omited in script.
            else for (let stmt of elseLimb ?? []) $(stmt)
        }
    }
}
```

And then we can run a script like so :

```js
import { MicroRunner } from "micro/runner";

class DemoRunner extends MicroRunner {
    parser = new DemoParser
    reducer = new DemoReducer
}

let runner = new DemoRunner()
let script = `...`
let result = runner.run(script)
```


### Scoping

A key feature of Micro is the ability to scope (and thereby restrict the use of) macros and operators. The rules of the game are as follow : 

* When you pass operators/macros reducers to `$`, it gets available to **every** nested statement/expression you evaluate within it. So, what we were doing when giving macros and operators to `$` within our script reducer is providing implementations of those macros and operations that will be used when evaluating anything nested in our script. Since the script is the outermost syntactic structure, "nested in our script" actually means "anything".

* You may also pass operator and macro implementations to `$` in the reducer of other macros. The, it will be added to the available reducers to use whenever needed. The lookup for an operator/macro implementation works in a bottom-to-top way : first, check if one was passed to `$` inside the current macro, else look in the surrounding macro, and so on.

If you'd like to not completely override, but rather modify the behavior of an operator or a macro, you can use the first argument of the reducer (the `context`). Let's say you want a `verbose` macro that prints `Performing an addition !` whenever two things are added within its body. Here's what you would write :

```js
'verbose': ({ $, operators }, { body }) => {
    let modifiedPlus = ([a,b]) => {
        console.log("Performing an addition !")
        return operators['+']([a,b])
    }

    for (stmt of body) {
        $(stmt, { operators: { "+": modifiedPlus } })
    }
};
```

Here, we supply a new version of `+` through `modifiedPlus` when evaluating the statements in our `verbose` macro, so we override the old one ; however, inside the `modifiedPlus` implementation, we return `operators['+']([a,b])`, meaning that we delegate the actual implementation of the operator to whatever the ambiant one is. Similarly, `context` has a `macro` field containing the ambient macros if you need them. Generally speaking, this is a good practice, since this forbidds nested macros to interfere with one another. Here, should you nest two `verbose` blocks inside another, you'd get two `Performing an addition !` whenever + is called, which is the expected behavior. If you try to delegate to a non-existing implementation of an operator/ a macro, this will result in a call to `MicroReducer.defaultOpReducer` and `MicroReducer.defaultMacroReducer` respectively. The default behavior of those two is to throw, but you can override them if needed.

In fact, `operators` allow to fetch the whole list of the ambiantly defined operators. For instance, if we want to upgrade our `verbose` macro so that every operator use is traced :

```js
'verbose': ({ $, operators }, { body }) => {
    let tracingOperators = {}
    for (let op in operators) {
        tracingOperators[op] = (...args) => {
            console.log(`'${op}' was called.`)
            return operators[op](...args)
        }
    }

    for (let stmt of body) {
        $(stmt, { operators: tracingOperators })
    }
}
```


### The lift function

Finally, let's come back to `lift`. When the parser encounters a number literal, say `0`, it generates an `AST` corresponding to the application of the operator `#number` to the literal `'0`. Now, when we ask it to actually evaluate that number, it will attempt to call the `numberReducer` we wrote earlier. What should the single argument to `numberReducer` be ? Sure, it could pass the literal `'0` directly as the string `"0"`, but that would be assuming we agreed on that, which we didn't. Maybe the values we're passing around are actually `[type, value]` couples, because we do not want to accidentaly add a string and a number together, and passing in plain string to our reducers would be some kind of contract violation.

The workaround Micro adopts is to use a `lift` function, which lifts, or promotes, a literal string to a usable value. Taking back our `[type, value]` example, we could have written something like :

```
lift = literal => ["literal", literal]
```

so that plain, untyped literal strings do not run freely in our program, and no contract is broken. Here, that's not how we chose to proceed (we only manipulate numbers, so adding a `type` info would be superfluous ; hence, we just return the literal as is, knowing that it will be parsed into `#number` no matter what), but that's something that very often is handy when our language grows bigger.

### Literal operators

Due to literals actually being calls to special operators, their behaviors are heavily customizable. Take `#name`, for instance. Earlier, we wrote `if (0) { ... }` to forbid a block to execute. That works, but it's not very good-looking. We could create a nullary `#false` operator, but that does also feel off. Besides, things like `#false || #true` would be understood as `#false (|| (#true))`, which is really bad. However, here's a third option :

```js
nameReducer = nameLiteral => {
    switch (nameLiteral) {
        case "true": return true;
        case "false": return false;
        default: ...
    }
}
``` 

That `default` block could be anything : throwing, or actually implementing variables with, say, a `HashMap`. What's important is the fact `#name` allows for fine-grained control over identifiers, so that you can actually treat `true`, `false`, or, say, `null`, separately from the rest. Same goes for `#number` and `#string`.


### Handling more-than-binary operators

Let's try to write a script that adds four zeroes together :

```
0+0+0+0
```

This will crash, actually, because this is understood as applying `+` to four operands at a time, where `+` has an arity of `2` only. The fix is as follows : first, we have to change `+`'s arity : 

```js
import { twoOrMore } from "micro/parser"

// -- snip --

// twoOrMore is actually just [2, Infinity], but it's provided by Micro for the sake of lisibility.
{ name: "+", arity: twoOrMore }
```

Then, we have to change our reducer :

```js
plusReducer = args => args.reduce((a,b) => a+b)
```

What we're implicitely saying here is that `+` is left-associative, because `Array.reduce` starts with the leftmost item of the array, so we're just doing `0+0+0+0 => ((0+0)+0)+0`. There's a shortcut provided by Micro for that :

```js
import { lar } from "micro/reducer";

// Left Associative Reducer
plusReducer = lar((a,b) => a+b)
```

Should you want a right-associative operator, there's `lar`'s counterpart, `rar`. If your operator is neither left, nor right associative, then you'll have to write it by yourself.


## AST manipulation

### A simple example 

Suppose we want to implement pipes into our language. Pipes are a proposed javascript feature (that has not yet made it into the official specification). It looks like this :


```
x |> f(_) |> _+1 |> console.log(`Result : {_}`)
```

Here, we pipe `x` into `f`, then add `1` to the result and log it to the console. This is equivalent to :

```
console.log(`Result : {f(x)+1}`)
```

Let's think about how we would do that in Micro. Strictly speaking, we just need to override the behavior of `#name` so that `_` gets treated specially, and to use a `|>` operator. Let's declare them :

```js
{ name: "#name", arity: 1 },
{ name: "|>", arity: twoOrMore }
```

Now, we have to (try to) write the reducers, and that's the moment we realize this won't work. Think about it : an operator automatically evaluates every operand before handing them to the reducers, but that means that we do not have enough control over `#name` to tell it "`_` means the previous value in the second and following operands, but it does not have a special meaning within the first", because the same implementation of `#name` will be used to reduce every operand. To work around that, let's instead wrap the whole expression inside an inline `pipe` macro :

```
pipe x |> f(_) |> _+1 |> console.log("Result : {_}");
```

Since `pipe` is a macro, inside it we *do* have control over how things are evaluated, in which order and using which operators. So, let's do that by writing its reducer :


```js
({ $, operators }, { head: [pipeExpr] }) => {
    assertOpKind(pipeExpr, "|>")
    let pipe = pipeExpr.operands
    let n = pipe.length
    let localOps = { "#name": l => l === "_" ? value  : operators["#name"](l) }

    let value = $(pipe[0])
    for (let i=1;i<n;i++) value = $(pipe[i], { operators: localOps }) 
    return value
}
```

The new thing here is the use of `assertOpKind` and `.operands` to act directly on the AST instead of evaluating it. Here, we tell that inside our `pipe` macro there must be a single `|>` operation, and then we retrieve its operands without `$`-ing it. The remaining code is pretty self explainatory : We evaluate the first of these operands normally, and store the result in `value`. Then, we evaluate the next ones using a local `#name` implementation that returns the current value if that name is `_`, or delegates to the ambient implementation if that's not the case. Finally, the value of the last expression is returned. 

When you need to implement a syntactic feature that does not seem to be possible using only operator reducers, always think about wrapping it all inside an inline macro, and act on the AST instead. 

### Syntactic typing and prechecks

As your language grows bigger, you might want to have a stronger grasp on the syntax than just relying on the native micro parsing. For example, suppose you add an `import` feature with a macro, that looks like this :

```js
import A from "file";
```

Syntactically speaking, there's no problem implementing that ; here's a declaration and a reducer that would do the job :

```js
// Declaration. Recall `import A from "file"` is `import (A) from "file"` since `import` is an inline macro, hence the arity
{ name: "import", arity: oneOrMore, kind: "inline", limbs: ["from"] }

// Reducer
({$}, { head: items, limbs: { "from": [source] } }) => {
    return actualImportImplementation(
        items.map(getLiteralOfName),
        $(source)
    )
}
```

With `getLiteralOfName` a built-in function that returns `"x"` when given `[#name 'x]`. Now, note that this is perfectly valid Micro syntax :

```
7 + import A from #print "lol";
```

Which isn't great, to say the least. It would be handy to carry around the information that `import`s are not to be used as actual values, that after `from` comes a string, and so on. Good news, Micro ships a feature called syntactic typing that does exactly that. In regular languages, typing is used to distinguish a number from a string ; in Micro, it's to distinguish an `import` statement from a string literal. So, how do we use it ? 

First of all, at least for now, we're not that interested anymore in evaluating the AST. We just want to proceed to a thourough check of it, by going through it and reporting any error. Then, and only then, we'll try to actually reduce the AST. To make clear these two are separate concerns, we'll create a new class that will have the single responsability of checking the AST :

```js
import { MicroReducer } from "micro/reducer"

class DemoSyntaxChecker extends MicroReducer {
    // ...
}
```

As you see, it's also a `MicroReducer`, because the API we need now is no different from the one we used to reduce ASTs. Let's write our syntax checker :

```js
import { MicroReducer } from "micro/reducer"
import { lang } from "micro/typing"
import { checkIsStringLiteral, checkIsNameLiteral } from "micro/ast"


class DemoSyntaxChecker extends MicroReducer {
    lift = _ => lang.literal

    script = ({$},  { body }) => {
        let opCheckers = {
            "+": (a,b) => {
                a (lang.expr)
                b (lang.expr)
                return lang.expr
            },
        }

        let macroCheckers = { 
            "import": ({$}, { head, limbs: { "from": [source] } }) => {
                head.forEach(checkIsNameLiteral);
                checkIsStringLiteral(source)
                return lang.stmt.imprt;
            },

            "if": ({$}, { head: [condition], body }) => {
                $(condition) (lang.expr)
                for (let stmt of body) $(stmt) (lang.stmt)
                return lang.expr
            }
        }

        for (let stmt of body) {
            $(stmt, { operators: opCheckers, macros: macroCheckers }) (lang.stmt)
        }

        return lang.script
    }
}
```

Here, instead of actually implementing our operators and macros, we're checking for their syntax. This can be done in three ways :

* Using the built-in `check-` functions. Like their name suggest, they enforce a condition onto their argument. For instance, `checkIsStringLiteral(source)` ensures `source` is an AST of the form `[#string 'lit]`

* Using `$(expr)`. It checks `expr` according to the ambiantly defined checkers, and the (optionnaly) provided ones. Scoping rules apply just like when reducing the AST. Note that this is automatically performed on every operand of an operation, just like those same operands are automatically reduced before being passed to the operator reducer. 

* Using the `type (typeSpec)` syntax. Just like reducers, checkers can return a value, which will then be output by `$`. If you want to use the syntactic typing feature of Micro, you have to import `lang` (shorthand for "language") from `micro/typing`, which is known as the root type specifier, because all other type specifiers stem from it. Then, you can make you checkers return the type of the thing they check - for instance, the `import` checker here returns `lang.stmt.imprt`. Having checked an AST with `$`, you'll then obtain the syntactic type of that `AST`, here denoted as `type`. Say `ast` turns out to be of type `lang.expr.variable`. Then, `$(ast) (lang.expr)` (which you can read as "check `ast` by itself, and then on top of that ensure it corresponds to a `lang.expr`") and `$(ast) (lang.expr.variable)` will suceed, while `$(ast) (lang.stmt)` won't, because `lang.expr.variable` doesn't start with `lang.stmt`. 

Let's come back to the checker written above. From now on, these :

```
1 + import A from "file";
import B from #print "lol";
```

Would both trigger a syntax error. The reasons are :

* For the first one, `+` expects both arguments to be `lang.expr`, but `import` returns a `lang.stmt.imprt`, so it will crash.
* For the second one, `import` uses `checkIsStringLiteral` on `#print "lol"`, which of course throws.

Note that the `lang` object twists the way property access works (it's implemented using JS' native `Proxy` class, if you're wondering), meaning you can actually use any specifier you'd like : `lang.my.brand.new.type.specifier` works perfectly fine and creates a new type specifier named exactly that. Finally, we have to specify to the runner we want to use that checker like this :

```js
class DemoRunner extends MicroRunner {
    parser = new DemoParser
    checkers = [new DemoSyntaxChecker]
    reducer = new DemoReducer
}
``` 

You can provide several checkers if needed, and they'll be ran in the provided order. Also, checkers are not restrained to syntax checks : you can very well use them to ensure that at runtime, in `x+y`, `x` will indeed evaluate to something that can be added to `y` (this corresponds to a type system in the more traditionnal use of the term), which has nothing to do with syntax and syntactic typing.