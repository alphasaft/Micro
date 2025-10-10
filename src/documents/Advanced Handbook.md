# Micro's advanced hanbook

If you read the [beginner's handbook](Beginner%20Handbook.md) first, that's great, else I strongly advise you to do so. In this handbook we're going to cover Micro's medium and advanced features, and expand on the things we've seen in the beginner's handbook.

## Table of contents

1. [Advanced operators features](#1-advanced-operator-features)
    1. [Arity and precedence](#11-arity-and-precedence)
    2. [Primitives & lift](#12-primitives--lift)
    3. [Utility functions](#13-utility-functions)
2. [Advanced macro features](#2-advanced-macro-features)
    1. [Head, body and limbs](#21-body-head-and-limbs)
    2. [Scoping](#22-scoping)
    3. [Delegating](#23-delegating)
3. [AST manipulation](#3-ast-manipulation)
    1. [What's an AST ?](#31-whats-an-ast-)
    2. [AST manipulation example](#32-ast-manipulation-example)
    3. [Utility functions](#33-utility-functions)
4. [Checkers](#4-checkers)
    1. [Concept](#41-concept)
    2. [Syntactic typing](#42-syntactic-typing)
5. [Error handling](#5-error-handling)
    1. [The `ReducerError` class](#51-the-reducererror-class)
    2. [Contextualizing](#52-contextualizing)

## 1. Advanced operator features

### 1.1. Arity and precedence

In the beginner's handbook, we've glossed over the generic process of declaring and implementing operators, but we didn't linger on the details, which is what we'll do here. First, let's talk about the arity. As explained in the [beginner's handbook](Beginner%20Handbook.md), when declaring an operator, you have to specify an arity, which must be either a number, or a 2-sized array, inclusive at both endpoints. If that arity is two, you can use the operator in infix mode, as in `a+b`. That's what was done in the beginner's handbook, but that's not the only possibility.

If that arity is one, then the operator is to be used in prefix mode :

```
{ name: '+', arity: 1 }  -->  +x
```

You may wonder what a `arity: 3` (we say `3`-ary or ternary) operator looks like. In Micro, operators follow a so-called packed behavior. This means that writing `1+1+1`, for instance, is not `(1+1)+1`, nor `1+(1+1)`, but the operator `+` applied to three `1`'s at a time. Hence, if you want to use expressions such as `a*b*c`, you have to give `*` an arity of `3` :

```
{ name: '*', arity: 3 }  --> a*b*c
```

But this in turn means you can only use `*` that way : with that declaration, `1*1` would yield an error, reading `* was declared with an arity of 3, got 2 operands`. To solve that, we need to specify arity as a range :

```
{ name: '-', arity: [1, Infinity] } 

-a
a-b 
a-b-c 
a-b-c-d
...
```

Then our reducer must be updated to take that into account :

```js
let minusReducer = ($, a, ...xs) => {
    // Used in a prefix fashion, as there's only a single operand
    if (xs.length === 0) return -$(a)
    // Used in an infix fashion (2-ary or more)
    else return $(a)-xs.map(x => $(x)).reduce((x,y)=>x+y)
}
``` 

Another thing to keep in mind is the precedence. The order in which you declare operators in the `MicroParser` is their relative precedence, that allows Micro to know how composite expressions like `1+2*3` must be read. Here, you might be tempted to answer that the question isn't really one, as everybody would know `1+2*3` is `1+(2*3)` and not `(1+2)*3`. But that's simply a convention, although well-established : what about an expression with weird operators, like `a @ b &~ c` ? Is it `(a @ b) &~ c`, or `a @ (b &~ c)` ? Precedence allows to solve that problem, by specifiying which operators "go first". To have `a @ b &~ c` be read as `(a @ b) &~ c`, you would have to declare `@` before `&~`.

Note that two operators passed side by side in a list, as `+` and `-` in :

```js
class DemoParser extends MicroParser {
    constructor() {
        super({
            operators: [
                [{ name: '*', arity: [2, Infinity] }, { name: '/', arity: [2, Infinity] }],
                [{ name: '+', arity: [1, Infinity] }, { name: '-', arity: [1, Infinity] }],
            ]
        })
    }
}
```

will have the same precedence. When two operators have the same precedence, the leftmost one wins, i.e `1+2-3` would be understood as `(1+2)-3`, and `1-2+3` as `(1-2)+3`.

### 1.2 Primitives & lift

In Micro, primitives in the usual sense work in what can seem a rather convoluted way, but is done to ensure maximal customizability at minimal cost. Talking about primitives can refer to three related things in Micro :

* Numbers, like `0.1` or `42`, which are mapped as `#number` calls,
* Strings, like `"hello"` or `"world"`, which are mapped as `#string` calls,
* Names, like `foo` or `bar`, which are mapped as `#name` calls.

Whenever such a primitive is encountered in a script, the appropriate operator is generated, with what is called a literal as its sole argument. This in particular mean that if said operator wasn't declared in the parser, you can't use the associated primitive in your scripts. As its name suggests, a literal is a literal excerpt of the source code, and is denoted as `'lit_value`, with `lit_value` any sequence of characters, that must be enclosed within backticks if there's non-letters among them. For instance :

```
foo         --> #name 'foo
0.          --> #number '`0.`
"world !"   --> #string '`world !`
```

Now, when you ask Micro to evaluate such an expression, it needs to evaluate the literal within it first. This is the role of the `lift` function introduced in `handbook/beginner.md` : provided a string `s` representing the literal, `lift(s)` is understood as evaluating the literal (in a sense, it promotes, or lifts, the string to a usable value, hence the name). The returned value is then passed as usual to the operator reducer. So, for instance, if we take :

```js
lift = s => s
numberReducer = ($, s) => parseInt($(s))
```

and apply it to `0`, what we do is to interpret the string literal ``` '`0` ```that will be generated by the parser as `"0"` with `lift`, telling we indeed want to see literals as pure strings, and then get an int out of it with `parseInt`. Here, it's not clear why we needed `lift` in the first place, as it does nothing particular and just returns the literal as-is ; we'll see examples of applications where `lift` isn't `s => s` in the [syntactic typing](#4-syntactic-typing) section. 

### 1.3 Utility functions

Micro ships a few utility functions to write cleaner reducers faster. Among them are :

* `plain` : This creates an operator reducer that just evaluates its operands before performing some computation with them. `plain((a,b) => a+b)` is the same as `($,a,b) => $(a)+$(b)`, and is clearer. Operator reducers that can be written with `plain` are called plain operators. An example of an operator reducer than isn't plain is given in the [AST manipulation](#3-ast-manipulation) section.

* `plar` and `prar` : Like `plain`, these create an operator reducer that directly evaluate their arguments and perform some computation with them. `plar` stands for Plain Left-Associative Reducer, and `plar(f)` is `($, ...args) => args.map(arg => $(arg)).reduce(f)`. Similaly, `prar` is Plain Right-Associative Reducer. 

A lot of reducers you'll write will follow these patterns, so remember they're here.

## 2. Advanced macro features

### 2.1 Body, head and limbs

As you might have seen from the [syntax reference](Syntax%20Reference.md), a macro can actually be much more than what is presented in the [beginner's handbook](Beginner%20Handbook.md). There's several different possible syntaxes for a macro (`inline`, `block` and `declarative`, once again see the syntax reference), but in the end all of these are parsed into the same format : a `MacroAST`. It is a simple data object with six members :

* `type` : Always `"macro"`. This is to distinguish it from the other AST types.
* `name` : The name of the invoked macro.
* `metadata` : The info relative to which piece of Micro code produced the AST. `metadata` is extensively used in [error handling](#5-error-handling).
* `head` : The arguments passed to the macro, as a list of ASTs.
* `body` : The statements inside the macro, also as a list of ASTs.
* `limbs` : The different limbs with which the macro was invoked. It is an object, with one field for each limb ; each of these limbs is a list of ASTs.

When writing a macro reducer, this is what's truly going on under the hood : you get a context (the first argument, which contains `use`), as well as a `MacroAST`, and you are tasked with telling how that `AST` must be evaluated. For instance, let's consider a `if` macro. We want it to take a condition, and, if it's true, evaluate its body. Otherwise, it should evaluate its else limb : 

```
if (condition) {
    ifBody
} else {
    elseLimb
}
```

The declaration would be :
```js
{
    name: "if",
    arity: 1,    // Takes the condition as its sole argument
    kind: "block",
    limbs: { name: "else", mandatory: false }
}
```

And the reducer would look like :

```js
ifReducer = ({use}, { body, head: [condition], limbs: { else: elseLimb } }) => {
    let $ = use({})

    // Since the else limb is not mandatory, it might be undefined if it's not present in-script.
    // In that case, we just replace it with an empty list of statements.
    elseLimb = elseLimb ?? []  

    if ($(condition)) for (let stmt of body) $(stmt)
    else for (let stmt of elseLimb) $(stmt)
}
```

Implementing any macro is as simple as that. The fact each and every macro is parsed as a `MacroAST`, with an invariant interface, allows to easily decouple syntax and semantics, as well as to write macros very quickly, resulting in lightning-fast customization of the language.

### 2.2 Scoping

Scoping is perhaps one of the most important features of Micro. That term refers to the fact operator and macro reducers have a certain semantic scope, and are available to use within that sematic scope - and only within. Let's take back our `if` macro, and put it in the broader context of a small arithmetic language. Those are the declarations :

```js
{
    operators: [
        [{ name: '#number', arity: 1 }],
        [{ name: '*', arity: 2 }, { name: '/', arity: 2 }],
        [{ name: '+', arity: 2 }, { name: '-', arity: 2 }],
        [{ name: '#print', arity: 1 }]
    ],
    macros: [
        { name: "if", arity: 1, kind: "block" },  // Could add an else limb, but for the demonstration it isn't needed.
    ]
}
```

Now, let's write some basic reducers :

```js
class DemoReducer extends MicroReducer {
    lift = s => s

    script = ({use}, { body }) => {
        let $ = use({
            operators: {
                '#number': ($,s) => parseInt($(s))
                '*': ($,a,b) => $(a)*$(b)
                '/': ($,a,b) => $(a)/$(b)
                '+': ($,a,b) => $(a)+$(b)
                '-': ($,a,b) => $(a)-$(b)
                '#print': ($,a) => console.log($(a))
            },
            macros: {
                'if': this.ifReducer
            }
        })
    }

    ifReducer = ({use}, { head: [condition], body }) => {
        let $ = use({})
        if ($(head)) for (let stmt of body) $(stmt)
    }
}
```

You may notice while in `script` we declare a handful of reducers, in `ifReducer` we do not, and instead just go for `let $ = use({})`. This is because, when declared, operator and macro reducers are available for every nested (directly or indirectly) structure. So here, any macro evaluated using the `$` defined in `script` will have the reducers for `+`, `-`, `*` and `/` at its disposal, even if doesn't redeclare them in their own reducers.

If there's a conflict between two reducers, the golden rule is : innermost wins. That is, if `if` were to declare its own `+` reducer, inside it it would prime over the global, `script`-level defined `+` reducer.

> **NOTE** : In operator reducers, there's no `use` function, and the `$` is available from the go ; this is because, for performance (and boilerplate code avoidance) reasons, operators do not get to redefine operators and macros inside their own reducer, and must use the ones ambiantly defined : the `$` is internally always obtained as `let $ = use({})`.

### 2.3 Delegating

Sometimes, you'd like to have more control over scoping than just the binary choice "Do I define it there or not". Suppose we want to write some `verbose` macro, that prints to the console whenever an addition is performed within its body. We would declare it as a block macro with 0 arity, and then write the reducer :

```js
let verboseReducer = ({use}, { body }) => {
    let $ = use({
        // We override locally the plus operator to log its invocations.
        '+': ($,a,b) => {
            let $a = $(a), $b = $(b)
            console.log(`Adding !`)
            return $a+$b
        }
    })

    for (let stmt of body) $(stmt)
}
```

This will work, to some extent. As soon as you try to nest two or more `verbose` blocks inside one another, the `+` implementation of the inner one will override every other, and thus it will print to the console only once - although it would be a reasonnable expectation to assume nesting n blocks will log n times. Hence, we need to be able to override the ambient implementation locally, but not totally. For that, the first argument of reducers (which we usually only pattern-match to get `use`), `context`, also makes available the ambient reducers. Here's our updated `verbose` reducer : 

```js
let verboseReducer = ({use, operators}, { body }) => {
    let $ = use({
        // We override locally the plus operator to log its invocations.
        '+': ($,a,b) => {
            console.log(`Adding !`)
            // But now we delegate back to the ambient implementation after we're done !
            return operators['+']($,a,b)
        }
    })

    for (let stmt of body) $(stmt)
}
```

This fixes our problem as desired. `context` also has a `macros` field with a similar purpose if needed.

One thing you have to always keep in mind when writing operators that delegate is that you cannot pass evaluated quantities to the original operator implementation (it always takes `$` and the unevaluated ASTs as arguments). This means you should always keep in mind the fact if you evaluate expressions in your new reducers, then delegate, those expressions might be evaluated twice, which is something you might want to avoid as much as possible as it can cause unexpected bugs (think of someone writing code and then seeing it being executed twice for seemingly no reason !)

Let's further illustrate while evaluating then delegating, or delegating twice, is almost always a bad idea. Take for example an imaginary `execTwice` macro, that, well, executes twice every statement in its body. You could go all in and write :

```js
execTwiceReducer = ({use, operators, macros}, { body }) => {
    let localOps = {}
    for (let opName in operators) {
        localOps[opName] = ($, ...args) => {
            // Simply invoking the ambient reducer twice
            operators[opName]($, ...args)
            operators[opName]($, ...args)
        }
    }

    let localMacros = {}
    for (let macroName in macros) {
        localMacros[macroName] = (ctx, ast) => {
            // Same here
            macros[macroName]($, ...args)
            macros[macroName]($, ...args)
        }
    }

    let $ = use({
        operators: localOperators,
        macros: localMacros,
    })

    for (let stmt of body) {
        $(stmt)
    }
}
```

Now, can you guess what will happen if we run a script that looks like :

```
execTwice {
    if (true) {
        #print "hi !"
    }
}
```

The answer is : "hi" will get printed four times. The reason is that when the `if` block is executed, it will be twice. And then each statement in it, in each of those two iterations, will be executed twice, totaling to four `#print`s. The lesson to get out of this is : unless you're absolutely sure of what you're doing, don't evaluate any AST when delegating - and do not delegate more than once. Especially when this would have been a valid implementation : 

```js
execTwiceReducer = ({use}, { body }) => {
    let $ = use({})
    for (let stmt of body) {
        $(stmt)
        $(stmt)
    }
}
```

## 3. AST Manipulation

There will come times when you'll not be satisfied with how Micro's AST evaluation process natively works, often because you'll have a specific syntax in head that does not need to actually evaluating ASTs, but instead access directly the source code they were generated from. Good news : that's totally on the table. Micro will never prevent you from messing with the ASTs yourself, if you need to. Even better, it'll actively help you in that task, and, since all ASTs expose a similar interface, there's not much to learn.

### 3.1 What's an AST ?

Until now, we've only explored superficially the concept of ASTs. At this point, if you didn't already, you should probably take a (prolonged) look at the [syntax reference](Syntax%20Reference.md), because understanding ASTs require to know what a Micro script looks like. When it's done, you can come back here. 

Let's sum up what we know of ASTs :

* They're generated by the parser when it reads a script,
* You can evaluate them using `$`,
* That evaluation process relies on the reducers you defined.

Said like this, they seem like complicated structures with tons of mysterious stuff going on, but they're not. In fact, we already got a glance of what they look like when writing [advanced macro reducers](#21-body-head-and-limbs) : they're simple javascript objects with a few fields describing the source code that resulted in their production, and come in three flavors :

* Macro ASTs, that represent some macro invokation. As I've said, we've already covered them, so I won't double down on that here.

* Operation ASTs, that represent an operation of some kind. They have four fields : `type`, which is always `"operation"` and identifies them among other the two other AST types, `op`, which is the operator, `operands`, which are... well, the operands, and `metadata`, which is covered in the [dedicated section](#51-Metadata).

* Literal ASTs, that represent a `'literal`. They got three fields : `type` (always `"literal"`), `metadata`, and `value`, which holds the literal value as a string : here, `value` would be `"literal"`.

And that everything there is to it. When you ask Micro to evaluate some AST using `$`, it checks its type and acts accordingly : if it's a literal, if `lift`s it, else it searches for the corresponding reducer and calls it with the appropriate parameters. This means there's no black magic at work here ; in a sense, all that Micro does is abstracting away the reducers lookups. This simplicity is a good thing : it means you can without any problem add your own grain of salt in the process.


### 3.2 AST manipulation example

Suppose we want to introduce a new feature, called pipes. Pipes are a currently pending JS proposal in stage 2 (meaning we won't get them anytime soon, but hoping is a free action), that work as follow : when several expressions separated by `|>` would be written, the first one would be evaluated, then the second one by replacing every occurence of `_` by the result of the first expression, etc. So `x |> f(_) |> _*_` would be `f(x) * f(x)`. That's a pretty cool feature in my opinion, and implementing it with Micro using AST manipulation is a breeze. First, note that we need to take control of how the `_` (and hence the `#name` operator) behaves inside our pipes. Since that's not something operators can do alone, we will need to wrap the expression in a macro, that we'll call `pipe`. Our final syntax would therefore be `pipe expr1 |> expr2 |> ...` (read "pipe `expr1` into `expr2` into ..."). Let's declare the needed operators (assuming `#name` already is) :

```js
super({
    operators: [
        ...,
        [{ name: '|>', arity: twoOrMore }],
        ...,
    ],
    macros: [
        ...,
        // In inline macros, the sole expression following its name is taken as its head
        // so we need to set the arity to one.
        [{ name: "pipe", arity: 1, kind: "inline" }] 
    ]
})
```

And write the reducer :

```js
import { getLiteral, checkIsLiteral, checkIsOp } from "micro-lang"

class DemoReducer extends MicroReducer {
    ...

    // Don't forget to pass it to `use` inside `script` !
    pipeReducer = ({use, operators}, { head: [pipeExpr] }) => {

        // We check the syntax is correct
        checkIsOp(pipeExpr, '|>')

        // Then retrieve the expressions inside the pipe
        let expressions = pipeExpr.operands 
        
        let $ = use({}) // The first expression is evaluated only using the ambient operators...
        let value = $(expressions[0])

        // But for the second, third, etc expressions, we need to override #name
        $ = use({ operators: { 
            "#name": ($,s) => {
                // Argument to #name should always be a literal.
                checkIsLiteral(s)
                
                // If it's the placeholder, return the current value
                // (getLiteral returns "l" when given an AST corresponding to 'l)
                // Note that as this doesn't evaluate s, but simply retrieves its value, this allows to
                // comply to the "no duplicate evalation" rule evoked in the 2.3 Delegating section.
                if (getLiteral(s) === '_') return value
                // If it's not, just delegate to the ambient implementation
                else return operators['#name']($, s)
            }
        }})

        for (let i=1; i<expressions.length; i++) {
            // We update the value as we go
            value = $(expressions[i])
        }

        // And finally return the value of the last expression
        return value
    }
}


// We don't need a reducer for |>, as the only cases it will appear will be inside
// pipeReducer (which does not evaluate it, but directly retrieves its operands), 
// so no |> operation will ever be evaluated.
```

That's done. A new, cool feature was successfully added to our language in twenty lines !

### 3.3 Utilitary functions

Unlike the utilitary reducers functions, which are in limited number and thus can be quickly introduced, there's a LOT of utilitary functions for AST manipulation. Their name should often be self-explainatory, and I encourage you to got check the official documentation if they're not. The rule of thumb is that if it's something that looks like it would be needed pretty often, it has a high chance to be already predefined for you to use. 


## 4. Checkers

### 4.1 Concept

As your language grows bigger, you might want to have a stronger grasp on the syntax than just relying on the native Micro parsing. This is already what we've been doing when [implementing our pipe operator](#32-ast-manipulation-example), as we've used functions such as `checkIsOp` to ensure the AST we were manipulating did indeed have the expect form. Now, this is a pretty common concern : is our script well-formed ? To answer that (pretty important) question, one possibility is to check everything we need to check using the built-in check functions at runtime, every time we run a script. That's, however, not that much of a good idea for three reasons :

* The first is that there's two concerns (checking the code and running it) in the same place (that is, your reducers).

* The second is that this has an impact on performance : after all, you can't expect your checks to run for free, and, even if that runtime cost is in practice not that big, this is worth mentionning.

* The third is that, even if there's something that's clearly a syntax error somewhere in the script, everything will run as usual, and the program will crash only when you get there.

Both problems are negligeable in the case of a small language : a very little amount of checks will be needed, and the separation of concerns is something it is important to worry about, but far more in big project than in small ones. However, adressing them can't be a bad things, and that's what we'll do here.

The `MicroRunner` class supports an additionnal property, `checkers`, which is a list of `MicroReducer`s. Unlike our main reducers, the result they return after running their main `script` reducer is discarded. Right after parsing the script, the checkers are ran in the provided order. If any of them deem the script to be incorrect at some location, they can throw an exception ; in that case, the whole process is immediately stopped and the script is not reduced by the `MicroRunner.reducer`. On the other hand, if all checkers run smoothly, then the script is actually reduced. Writing a checker is just like writing the main reducer : you write reducers (called checkers in that context) for each operator and macro. `$`-ing an AST, as usual, invokes the corresponding checker, so `$` is to be read as "check" when writing a checker. As the API remains the exact same, every `MicroReducer` feature, like scoping, work as usual. Notice, however, that unlike the main `reducer`, whose `script` reducer's return value is the thing that `MicroRunner.run` returns, the results produced by all checkers are simply discarded should they succeed.

Does it solve our problems ?

* The first is solved by design. Checks go in the checkers, actual script logic in the reducer.

* The second is also solved. `MicroRunner` exposes a `compile` method, that returns an `exec` function which, when called, reduces the script and returns the result. The difference with `run` is that `compile` parses and runs the checkers once, no matter how many times you call `exec` afterwards, while `run` runs everything everytime you call it. Also, in case of loops, for instance, the checkers will not run the loop (they'll only check its syntax once), whereas putting the checking logic in the reducer might result in that logic being located inside the loop and being executed at each iteration, which is non-optimal to say the least.

* The third is as well. Everything is checked at once and only then reduced, meaning if there's an error, it will be catched before even calling the `MicroRunner.reducer`.

That's a win ! The only thing that might cause you to think a bit about whether or not to write a separate checker is that it's additionnal code to write that is not always necessary if your language is small and easily maintainable.

Don't hesitate to write multiple checkers if they're multiple things to check for (syntax, types, ...)

### 4.2 Syntactic typing

Checkers, just like the reducer, are entirely up to you to write. One pattern, however, was so common in checkers that we decided to introduce native support for it. To illustrate, suppose you add an `import` feature using an inline macro, that looks like this :

```js
import A from "file";
```

Syntactically speaking, there's no problem implementing that ; here's a declaration and a reducer that would do the job :

```js
import { getLiteralOfName } from "micro-lang"

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

With `getLiteralOfName` a built-in function that returns `"x"` when given `[#name 'x]`. So, all good ? Not really, as this is a perfectly valid Micro script :

```
7 + import A from #print "lol";
```

Which isn't great, to say the least. And yet, Micro doesn't see any problem with that ; syntactically speaking, everything's fine. It would be handy to carry around the information that `import`s are not to be used as actual values, that after `from` comes a string, and so on. Good news, Micro ships a feature called syntactic typing that does exactly that. Here's an example of syntatic typing in action

```js
// not the only import, but we'll focus on that lang object here 
import { lang } from "micro/typing"


class DemoSyntaxChecker extends MicroReducer {
    lift = _ => lang.literal

    script = ({use},  { body }) => {
        let $ = use({
            operators: {
                "+": ($,a,b) => {
                    $(a, lang.expr)
                    $(b, lang.expr)
                    return lang.expr
                },
            },

            macros: { 
                "import": ({$}, { head, limbs: { "from": [source] } }) => {
                    head.forEach(checkIsNamePrimitive);
                    checkIsStringPrimitive(source)
                    return lang.stmt.imprt;
                },

                "if": ({$}, { head: [condition], body }) => {
                    $(condition, lang.expr)
                    for (let stmt of body) $(stmt, lang.stmt)
                    return lang.expr
                }
            }
        })

        for (let stmt of body) {
            $(stmt, lang.stmt)
        }

        return lang.script
    }
}
```

Here, we use some `check`- functions (which names should be self-explainatory, if not check out the documentation), but the true novelty here is `lang`, which is a special object called a type specifier. It is used in two places :

* It's returned from checkers, as with `+`, that returns `lang.expr`. This means "Hey, Micro, this is an expression !".
* When checking ASTs with `$`, it's passed as its second argument, for example in `if`, which passes `lang.stmt` every time it evaluates a statement in its body. This means "Hey, Micro, check this is a statement !".

Let's come back to the erroneous script written above. From now on, these :

```
1 + import A from "file";
import B from #print "lol";
```

Would both trigger a syntax error. The reasons are :

* For the first one, `+` expects both arguments to be `lang.expr`, but `import` returns a `lang.stmt.imprt`, so it will crash.
* For the second one, `import` uses `checkIsStringLiteral` on `#print "lol"`, which of course throws.

Note that the `lang` object twists the way property access works (it's implemented using JS' native `Proxy` class, if you're wondering), meaning you can actually use any specifier you'd like : `lang.my.brand.new.type.specifier` works perfectly fine and creates a new type specifier named exactly that. Another thing of note is that the check allow for more specificity : `lang.expr.anonymousFunc`, for example, can be considered as a simple `lang.expr` (but the converse is, of course, not true).

Also, don't forget to add the checker to the runner !

```js
class DemoRunner extends MicroRunner {
    parser = new DemoParser
    checkers = [new DemoSyntaxChecker]
    reducer = new DemoReducer
}
``` 

## 5. Error handling

Generally speaking, when building systems with which external users will interact, clear error handling and reporting is one of the, if not the, most important things to have in mind. This is maybe even more true when designing a language : It's especially frustrating when you're in the process of learning a new language and make a stupid error that the compiler is simply unable of telling you clearly what went wrong. Hence, if you want your users to feel at home when using your language, it's primordial that the errors are easy to understand and fix. Luckily, while this will need a bit of care on your side, Micro does most of the job, without you even noticing.

### 5.1 The `ReducerError` class

Whenever throwing an error within a reducer (no matter what that error actually is : a `string`, a built-in error class, or even one you create), that reducer will catch it, wrap it (if it's not already wrapped) as a `ReducerError` instance, and rethrow it. The huge advantage of `ReducerError` is that it's able to gain a stack trace as it bubbles up the reducers. When it finally bubbles from `script`, it is catched by the `MicroReducer.handle` function. Here, the error is converted to string (using `ReducerError.toString`) and thrown. This result in a nicely formatted error message tracking the error down to the exact piece of code that triggered it.

Now, you may ask why I'm telling you all of this. Mostly because you might want to opt-out from all this autowrap stuff from time to time. For that, there's the native `unwrapError(e)`, that returns `e` itself if it's not a `ReducerError`, otherwise unwraps it. Specifically, when catching errors while uing Micro, it is a good pratice to always `unwrapError`s before handling them, just in case.

> **NOTE** : `ReducerError` also has an `unwrap` method that, well, unwraps it. The big downside is that if you call `e.unwrap()` when `e` isn't a `ReducerError`, this will make the program crash, while `unwrapError` takes care of that case.

### 5.2 Contextualizing

As we've seen before, `$` may take two arguments (as in `$(ast, lang.expr)`). That second argument must be a function, and `$(ast, f)` is almost `f($(ast))`. Almost. If any error happens while running `f($(ast))`, it will gain a stack frame telling it happened within the piece of code that produced `ast`. On the other hand, in `f($(ast))`, if `$(ast)` did not produce an error but `f` did, that error will be understood as happening in the external reducer, which can be confusing. Passing `f` as the second argument to `$` fixes that. 

> **NOTE** : On the other hand, every built-in check function, like `checkIsStringPrimitive`, will report the error, if there's one, as coming from the ast passed as their arguments.

Also, sometimes, you will feel the need to add bits of context to what's happening, so that it's clearer to your users how the error happened. For that, you can use the `contextualize(msg, block)` function. It simply calls `block` and returns its result, but, if there's an error, it (wraps it in a `ReducerError` and) adds `msg` to its stack trace. 

## Conclusion

We're done, for now at least ! Perhaps more features will be added, but for now, this is all there is. Don't forget to read the documentation if you need to, there's everything you need there. Have fun using Micro !