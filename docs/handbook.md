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


* The `script` function : this is the core of our `DemoReducer`. It takes two arguments, the first being a `Context` and the second the `AST` to reduce, which is the one we printed earlier. Here, we pattern match to get the `$` (read "evaluate") attribute of the context, as well as the `body` of our `AST`. Then, we iterate through each statement of our script, which also are `AST`s, to evaluate them sequentially. 
* The `lift` : While very simple in its implementation, the concept of `lift` is a bit complex, so we'll come back to it later.

So, are we done ? Well, not exactly. The reason for that is that we told our `DemoReducer` to evaluate each statement using `$`, but it has no idea how to do so, in the same way that it didn't know how to run a script. We'll have to figure it out for it.

To do so, we also need to provide reducers for the operators and macros themselves. To do that, we just need to write such reducers :

```js
class DemoReducer extends MicroReducer {
    lift = s => s;
    script = ({$}, { body }) => { for (let stmt of body) $(stmt) };

    globalOpReducers = {
        '+': ([a,b]) => a+b;
        '-': ([a,b]) => a-b;
        '*': ([a,b]) => a*b;
        '/': ([a,b]) => a/b;
        '#number': l => parseFloat(l);
    }

    globalMacroReducers = {
        'if': ({$}, { body, head: [condition] }) => {
            if ($(condition)) for (let statement of body) $(stmt)
        };
    }
    
}
```

Now, I would like to point out the specific forms the reducers take. Operator reducers are by far the simplest ones. They take their arguments as a list, then do stuff with it and return a result. Note that they don't need to evaluate anything using `$` : under the hood, our `DemoReducer` automatically `$`s every operand, so that you don't have to do it yourself. This is because while a script must be able to decide what to evaluate and when to do so, an operator always takes in some values and outputs another one. 

Our single `if` macro reducer, on the other hand, looks exactly like our global script reducer, and this is because these two are the exact same thing : the script really is just one big macro named `script` (that's why `printAST` displayed it in the same way as `if`), and the script reducer is nothing more than a plain macro reducer. 

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
class DemoReducer extends MicroReducer {
    // -- snip --
    
    globaMacroReducers = {
        'if': ({$}, { body, head: [condition], limbs: { "else": elseLimb } }) => {
            if ($(condition)) for (let stmt of body) $(stmt)
            // Note elseLimb can be undefined if the else limb is ommited in script.
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

A key feature of Micro is the ability to scope (and thereby restrict the use of) macros and operators. Any operator and macro you implement in `globalOpReducers` and `globalMacroReducers` is, obviously, available globally, and this is why we were able to use them everywhere in our script, but this is not the only way to proceed. `$` accepts two more arguments: `localOpReducers` and `localMacroReducers`. If provided when evaluating things inside a macro, these will override the outside-defined (we say "ambient") operator and macro definitions. The lookup for an implementation works in a bottom-to-top way : first, check if one was passed to `$` inside the current macro, else look in the surrounding macro, and so on.

If you'd like to not completely override, but rather modify the behavior of an operator or a macro, you can use the first argument of the reducer (the `context`). Let's say you want a `verbose` macro that prints `Performing an addition !` whenever two things are added within its body. Here's what you would write :

```js
['verbose'] = ({ $, operators }, { body }) => {
    let modifiedPlus = ([a,b]) => {
        console.log("Performing an addition !")
        return operators['+']([a,b])
    }

    for (stmt of body) {
        $(stmt, { "+": modifiedPlus })
    }
};
```

Here, we supply a new version of `+` through `modifiedPlus` when evaluating the statements in our `verbose` macro, so we override the old one ; however, inside the `modifiedPlus` implementation, we return `operators['+']([a,b])`, meaning that we delegate the actual implementation of the operator to whatever the ambiant one is. Similarly, `context` has a `macro` field containing the ambient macros if you need them. Generally speaking, this is a good practice, since this forbidds nested macros to interfere with one another. Here, should you nest two `verbose` blocks inside another, you'd get two `Performing an addition !` whenever + is called, which is the expected behavior. If you try to delegate to a non-existing implementation of an operator/ a macro, this will result in a call to `defaultOpReducer` and `defaultMacroReducer` respectively. The default behavior of those two is to throw, but you can override them if needed.


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
nameReducer = ([nameLiteral]) => {
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

Now, we have to (try to) write the reducers, and that's the moment we realize this won't work. Think about it : an operator automatically evaluates every operand before handing them to the reducers, but that means that we do not have enough control over `#name` to tell it "`_` means the previous value in the second and more operands, but it does not have a special meaning within the first". To work around that, let's instead wrap the whole expression inside an inline `pipe` macro :

```
pipe x |> f(_) |> _+1 |> console.log("Result : {_}");
```

Since `pipe` is a macro, inside it we *do* have control over how things are evaluated, in which order and using which operators. So, let's do that :


```js
"pipe": ({ $, operators }, { head: [pipeExpr] }) => {
    assertOpKind(pipeExpr, "|>")
    let pipe = pipeExpr.operands
    let n = pipe.length
    let localOps = { 
        "#name": l => l === "_" 
            ? value 
            : operators["#name"](l)
    }
    
    let value = $(pipe[0])
    for (let i=1;i<n;i++) value = $(pipe[i], localOps) 
    return value
}
```

The new thing here is the use of `assertOpKind` and `.operands` to act directly on the AST instead of evaluating it. Here, we tell that inside our `pipe` macro there must be a single `|>` operation, and then we retrieve its operands without `$`-ing it. The remaining code is pretty self explainatory : We evaluate the first of these operands normally, and store the result in `value`. Then, we evaluate the next ones using a local `#name` implementation that returns the current value if that name is `_`, or delegates to the ambient implementation if that's not the case. Finally, the value of the last expression is returned. 

When you need to implement a syntactic feature that does seem to be possible using only operator reducers, always think about wrapping it all inside an inline macro, and act on the AST instead. 

### Syntactic typing

As your language grows bigger, you might want to have a stronger grasp on the syntax than just relying on the native micro syntax. For example, suppose you add an `import` feature with a macro, that looks like this :

```js
import A from "file";
```

Syntactically speaking, there's no problem implementing that ; here's a reducer that would do the job :

```js
"import": ({$}, { head: items, limbs: { "from": [source] } }) => {
    return actualImportImplementation(
        items.map(item => getLiteralOfName(item)),
        $(source)
    )
}
```

With `getLiteralOfName` a built-in function that returns `"x"` when given `[#name 'x]`. Now, note that this is perfectly valid Micro syntax :

```
7 + import A from #print "lol";
```

Which isn't great, to say the least. It would be handy to carry around the information that `import`s are not to be used as actual values, that after `from` comes a string, and so on. Good news, Micro ships a feature called syntactic typing that does exactly that. In regular languages, typing is used to distinguish a number from a string ; in Micro, it's to distinguish an `import` statement from a string literal. 

Syntactic typing is implemented in a way that it's easy to use and so that there's no boilerplate code. We just have to import `typeSpecifier` from `micro/typing`, and declare a new root type specifier with `const lang = typeSpecifier()` (with `lang` standing for language, which is a standard name for the root type specifier). Then, we would write :

```js
"import": (...) => {
    return lang.stmt.imprt (actualImportImplementation(...))
}
```

Here, we just specify tell that `import`, syntactically speaking, is to be seen as asomething that returns a `lang.stmt.imprt`. You're free to choose any name you wish : `lang` is a special JS object that twists the way property access work (implemented using JS' `Proxy` class, if you're curious), so `lang.i.have.no.idea.what.i.m.writing` would not trigger any error and instead just define another type specificier called exactly that. Writing our `+` reducer, we would write : 

```js
"+": ([a,b]) => lang.expr (a (lang.expr) + b (lang.expr))
```

We tell that `+` returns a `lang.expr` value, and that its operands are also expected to be `lang.expr`. From now on, this :

```
1 + import (...) from (...);
```

will trigger an error : `import` returns a `lang.stmt.imprt` while `+` expects a `lang.expr`. Since `lang.stmt.imprt` does not **begin** with `lang.expr`, this crashes. I say begin, because `lang.expr.name` would match `lang.expr`. For type specifiers you use often, it's recommanded to alias them : `const expr = lang.expr` allows to rewrite `+` into :

```js
"+": ([a,b]) => expr (a (expr) + b (expr))
```

which is a bit lighter. Specifying the types of your expressions clarifies the intent of your code, as well as how your operators and macros must be used. 

Type specifiers are implemented in the following way : `typespec (x)` wraps `x` so that it can carry around that type information, then `x (typespec)` checks that `x` has the specified type and unwraps it. Effectively, that means that you can't use a typespec-ed value like a normal one : you **have** to tell which type you expect to actually unwrap the value (note that expecting `lang` effectively just unwraps it without checking anything since everything is qualified with `lang.something`). Hence, if you type some of your reducers, it's highly recommended to type them all, so that typed wrappers are passed everywhere and you don't have to worry about when to unwrap or not. That applies to `lift` : here, you would write something like : `lift = l => lang.expr.literal (l)`.

Always keep in mind that type specifiers are not a panacea. For instance, to solve the problem of `import A from #print "lol";` being legal, it would be more idiomatic to not actually `$` the `source`, and rather just use `getLiteralFromString` from the standard library onto it. This is because we know very precisely that we want a string primitive there, whereas `+` doesn't really care about how its operands are written ; rather, it just knows it won't work well on things that aren't `lang.expr`. 

Also, syntactic types must be used to check the syntax, not the semantics ; it's in the name. Suppose you want to refine `+` to check that it always adds numbers. You might be tempted to do this :

```js
const number = lang.expr.number
"+": ([a,b]) => number (a (number) + b (number))
```

Which works just fine until you want to have variables aboard. Indeed, that'd likely be `#name` :

```js
const variable = lang.expr.variable
const literal = lang.expr.literal
"#name": ([lit]) => variable (lookupTable.get(lit (literal)))
```

But then `x+3` won't do, because `x` doesn't have the syntactic type `lang.expr.number` (and indeed, `x` itself isn't a number, although it might evaluate to one). Therefore, it's better to just require `+`'s operands are `lang.expr`, and then check that their values are numbers.


### Performance

Checking every type at runtime must have a cost, you might think, and you'd be right : that overhead does exist and can become significant in some cases. This is a deliberate choice : Micro is **not** expected to be used in performance-critical applications. Rather, it is intended to expose a better interface for writing user-friendly domain specific code, and it is likely only small to medium-sized scripts will be written using it. Hence, clarity and simplicity were privilegiated over efficacity at all cost. Should your code be executed really quickly, you've got these two options :

* Not checking anything. Typing is used to ensure the correctness of scripts, but, in our example, adding `1` to `undefined` (which is likely the thing that untyped `import`s would return) would result in `NaN`. Then, that `NaN` value may, or may not, make something crash eventually. If you don't really care about the fact there's a possibility of some `NaN` value running around and/or expects the ones who'll write scripts not to mess around too much, then you might choose to proceed so.

* Prechecking your scripts. That's the subject of the next paragraph.


### Prechecks

This is a trick that mostly removes the aforementionned overhead without giving up on typing. It simply consists in pseudo-evaluating everything first, then actually running the script.

```js
script = ({$},  { body }) => {
    // CHECKING

    let opCheckers = {
        "+": ([a,b]) => {
            a (lang.expr)
            b (lang.expr)
            return lang.expr (null)
        },
        // ...
    }

    let macroCheckers = { 
        // ... 
    }

    for (let stmt of body) {
        $(stmt, opCheckers, macroCheckers) (lang)
    }

    // REDUCING

    let opReducers = {
        "+": ([a,b]) => a+b,
        // ...
    }

    let macroReducers = { 
        // ...
    }

    for (let stmt of body) {
        $(stmt, opReducers, macroReducers)
    }
}
```

So, what are we doing here ? Instead of passing globally the macros/operators with `globalOpReducers` and `globalMacroReducers`, we define two separate sets of local reducers : the checkers, and the actual reducers. Then, we go through the script once using our checkers, where only the syntactic types are checked and nothing is ran (you can see that to the fact we return `lang.expr (null)` within `+`'s checker instead of actually adding our two operands). When that's done, we run our scripts like we ever did, but without syntactic typing since everything was already checked. By doing so, we remove most of the overhead because, for example, the body of a `for` loop will be checked only once.

Feel free to write prechecks, or to just check everything at runtime. Both have their perks and downsides : writing checkers adds quite some code and can be pretty tedious, but it splits responsabilities and allows your scripts to run faster. Besides, expressions that will not be ran before long (e.g the body of a almost never used function) will still be checked before doing anything since the checkers browse the whole AST without consideration to when or how that code will execute.
