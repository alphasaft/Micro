# Micro

Micro is a small library (~600 lines of code) for creating languages adapted to your needs, allowing you to describe whatever data you'd like in a elegant and concise way. Here's an example of a Micro script designed to express todo lists :

```
todo("Main todo list") {
    #critical "Pay my taxes";
    #important "Clean my room";

    currentShow = "Arcane";
    #important "Watch " + ?currentShow;
};

todo("For my holidays") {
    #critical uppercase("Don't forget the keys !!!");
};
```

Micro scripts are all based on the same generic yet very polymorpheous syntax that you can adapt to your needs. Micro then allows you to quickly parse that language to generate usable JS values out of it.

The tool itself is written in Javascript, and requires you to know this language before you can use it (You can learn Javascript [here](https://www.learn-js.org/)). Furthermore, I will quite often use typescript syntax to describe what types are expected.

Without further ado, let's get started !

## The basics

### A small compiler to begin with 
 
We first need to create what is called an Micro compiler. For that, you need to import the `MicroCompiler` class in a JS file, and to write the following

> myCompiler.js
```js
let compiler = new MicroCompiler(
    [
        { name: "*", arity: 2 },
        { name: "+", arity: 2 },
    ],
    []
    _ => {},
    (_, _, _, _) => {},
)
```

The arguments passed to the `MicroCompiler<T>` (`T` being the output type for the compiler) constructor work as follow :
- A `(OpDeclaration | OpDeclaration[])[]`, to declare the operators our scripts will be able to use. Here, we declare the `+` and `*` operators.
- A `MacroDeclaration[]`, which declares the macros our script will be able to use.
- A `(literal: string) => T` function, called _lift_.
- A `MacroReducer<T>`, which is a function known as the _script macro_.

A `MicroCompiler<T>` is a javascript object meant to take in _scripts_ (`string`) as input, and to output an object of type `T`.

Don't worry about what the arguments mean, we'll come back to it later. Just know that you thereby defined a compiler, that will compile your own version of the Micro language.

You can compile any valid Micro script with `compiler.compile(src)`, that returns a `T`.

### Write an Micro script

Micro is a small language that has a pretty simple, yet very volatile syntax. An Micro script consists solely of a list of _expressions_. We separe expressions by semicolons, the last one being optional, and the script may include comments, wrapped inside a `[[ ... ]]` pair.

This is one of the smallest scripts you could ever write : 

```
1+1; [[ Note that this ';' is optional, as 1+1 is the last expression ]]
```

Every operator you declared previously might be used, but any other operator will induce a syntax error :

```
1-1; [[ This will crash with "Unknown operator '-'." ]]
```

The operators _arity_ requirements must also be met. When declaring `+`, for example, we told that its arity was 2, which means it takes in 2 arguments. If more or less than two arguments are passed to it (we'll see the syntax for that later), the compiler will crash with a syntax error.

Whitespaces and line returns are ignored, so this is perfectly valid :

```
1
+    1;  [[ Works ! ]]
```

### Expressions

Let's talk a little bit more about what an expression is. It consists of things (called operands), bound together by operators. An expression may also be a single operand. 

Operands can be one of the following :
* A literal. This can be a string (characters enclosed inside quotes, such as `"Hello world !"`), a number (`1` or `2.0` for instance), or a name (a letter or underscore, followed by letters, underscores and digits : `x`, `true` and `_list2` are names). Literals are the "elementary blocks" of your script, in that that they can't be split into smaller components.

* Another expression.

* A macro (the syntax of which I will tell you about later)


> `8`, `1+"hi"`, `x*y*z` and `1+(2*"hello")` are all valid expressions.


There's one very, very important thing you need to have in mind before going any further. We distinguish three concepts :  
* An _operation_ is the result of applying an operator to some other things, called operands. `1+1` is an operation, with the operator being `+` and the operands being two `1`.  
* An _expression_, on the other hand, can contain several operations. `1+1*1`, for example.
* A _statement_ is the designation given to a top-level expression, that is an expression that's followed by a semicolon and stands for itself. Syntactically speaking, statements and expressions are exactly the same thing, so we'll stick with "expressions" for both here.

An operation is pretty straightforward to understand when we see it : `1+1` is applying `+` to 1 and 1, period. However, for an expression, the whole thing is thougher. Take `1+1*1`, for example. Here, it's `+` and `*`, so we know, because we're used to them, that `*` comes before `+` and so the expression must be interpreted as `1+(1*1)`. But what if the operators had weird names like `@` and `||` ?

That's why you **always** have to tell yourself the compiler how expressions should be interpreted. Remember our [operator declarations](#a-small-compiler-to-start-with), and how the `*` operator was declared before `+` ? It means that whenever there is an ambiguity, `*` has a higher _precedence_ (since it stands before) than `+` (we also say `*` _binds tighter_ than `+`) and should be executed first. So, when the compiler encounters `1+1*1`, it knows that it means `1+(1*1)`.

> To declare two operators with the same precedence, you would wrap them side by side in a list, like so :

```js
[
    { name: "*", arity: 2 },
    [{ name: "+", arity: 2 }, { name: "-", arity: 2 }]
]
```

> Here `*` binds tighter than `+`, which binds as tight as `-`.

If several operators with the same precedence are encoutered in a single expression, the one at the left executes first, then the second, and so on. `1+1+1+1` therefore executes as `((1+1)+1)+1`.

> If you need to override precedence and execute `+` before `*` in an expression, you need to enclose it in parentheses : `(1+1)*1`.

### The long-awaited list of keywords

Now for the the list of all keywords of the language : 

No keywords, actually ! Instead, we got hash operators. These are operators that start with `#` (hence the name), followed by one or more letters : `#foo` or `#bar` for instance.  These are used just like normal, symbol-based operators, and allow for nicer syntax when needed : `elem >?> myList` is pretty obfuscated, while `elem #in myList` is crystal clear !

> If you wonder, here are the symbols that can be used in symbolic operators : `&|~^@=+'-$*%!/:.,?!<>`. Any combination of such symbols is a valid operator.

I repeat one more time, because it's quite important and easy to miss : **hash operators do not differ from standard operators like `+`, and it's only a matter of stylistic preference.**

### Macros

I said macros are a type of operand, but I didn't explain how to write one. Let's fix that.

For now, you can view a macro as some sort of block of code, that groups together several expressions.
The general syntax for a macro is the following (plus several tweaks we'll talk about later) :

```
macroName(arg1; arg2; ...; argn;) {
    statement1;
    ...
    statementn;
}
```

Which is much more complicated than anything we've seen until there, but bear with me.  
The thing between parentheses is called the argument list (or head), the thing between curly brackets is known as the body.

`arg1` (etc) as well as `statement1` (etc) should be valid expressions. For both lists, the final semicolon is optional.
If the head is empty, parentheses can be dropped, so this is valid syntax :

```
macroName { 
    [[ Some expressions here ]]
}
```

However, even if there are no expressions inside the body, the curly brackets aren't optional.
Note that the formatting (the line return after the first curly bracket, the indent, etc) is purely a question of style, and that this is fine as well :

```
macroName(
    arg1; 
    arg2;
    arg3;
) { statement1; statement2 }
```

`macroName` must have been declared through [the second argument of the compiler](#a-small-compiler-to-start-with). For example, if you want to declare a macro called `doSomething` that takes in one argument, you can replace the empty list with : 

```js
[{ name: "doSomething", arity: 1 }]
```

With `arity: 1` meaning the same as for operators : our newly created macro takes one single argument. An arity check is automatically performed everytime this macro is encountered, so this would crash :

```
[[ Fails with "Macro doSomething expects between 1 and 1 arguments, got 2." ]]
doSomething (x, y) {

};
```

You can add some flexibility to the number of arguments accepted by passing in a two-sized list instead : `arity: [a,b]` means the macro accepts between a and b arguments, inclusive at both endpoints.


Always remember that macros are still expressions, and, as such, this is valid syntax :

```
[[ Multiplying 1 by the result returned by myMacro ]]
1 * myMacro(...) { ... };

[[ And to remind you hash operators exist : ]]
hello #is mySecondMacro(...) { ... };
```

## Syntax versus semantics

You may have noticed that until now I only talked about what you could _write_, not about what it actually _does_.  The first thing is usually called the syntax of a program, the second its semantics.

This is actually what makes Micro stands apart from other languages. It's only a syntax. No semantics. If you compile a script, it actually does... nothing !

```js
compiler.compile("1+1*1;")
// Prints nothing, returns void.
```

> "But... wait ! I do want my code to do something, somehow !".   

Me too ! That's where it gets interesting. Remember the two other arguments we passed to the compiler ? It's time to actually understand what they do.

### Go touch some grass

First, let's talk about trees. 
In a typical programming language, before doing anything with a script, said script is usually translated in a much more practical form, called an _Abstract Syntactic Tree_ (or AST), and Micro is no exception to that.

Behind this daunting name hides a rather simple thing. Here's what it means. When you write `1+(2*3);`, for example, it's translated to something that roughly looks like `{ op: '+', args: [1, { op: '*', args: [2, 3] }] }`. It appears uglier, but it's now standard javascript and, as such, it's much easier for a program to manipulate it.

> The name comes from the fact you can represent it like so :

```
    +
   / \
  1   *
     / \
    2   3
```

> Which, if flipped, looks (somewhat, don't expect an computer scientist to know what a tree is) like a tree.
                     
In standard languages, it's, more often than not, **not** visible by the user, and directly used by the compiler to perform actions. In Micro, however, once the ASTs for the whole script are obtained (we say the script has been _parsed_), it's passed down to **you**, so you can do whatever you want with it.

> You don't need to understand how ASTs are implemented for now, but we'll talk about it later.

### Macros, again

And that's where macros kick in ! Conceptually, macros are functions that are meant to evaluate parsed code, and return a standard JS value of type `T`. A macro is made up of two things : a `MacroDeclaration`, which tell what the macro looks like, and something called a `MacroReducer<T>`, which tells what the macro does.

A `MacroReducer<T>` is a function that takes in four arguments to output an object of type `T` :
* An context, of type `Context<T>`,
* The body of the macro as a list of `AST`s. Each AST of the list is one expression inside your script. So if your macro contained `1+1; 2+2; 3+3;`, it will have length of 3. 
* The arguments to the macro as a list of `AST`s too ; same here, each argument is an `AST` on its own.
* An empty object called `limbs`. Don't worry about that last one for now.

When you write and compile a script, what actually happens is that it gets passed to the [script macro](#a-small-compiler-to-start-with) just like it was its body, with no arguments, so that it gets called like this : `scriptMacro(context, script, [], {})`. And that script macro gets to do whatever it wants with it.

The most important thing here is `context`. It has three members : `ev`, `operators` and `macros`, but we'll solely focus on `ev` for now.

The `ev` function pretty much does all the job and allows, as its name suggests, to _evaluate_ `AST`s.
Suppose we just want to evaluate sequentially every expression inside your script. We would write :

```js
let scriptMacro = ({ ev }, body, args, limbs) => {
    // See below for what `ops` and `macros` are here
    let ops = []
    let macros = []

    // We iterate throught each expression
    for (let expr of body) {
        // And evaluate it !
        ev(expr, ops, macros)
    }

    // There's no return value, meaning this macro will return undefined
}
```

And that's done ! Well, almost. Remember how I said that the Micro compiler has absolutely no idea about semantics ? That still holds. So how would it know that `+` adds two numbers and `*` multiplies them ?

By passing operators (of type `MapLike<OperatorReducer<T>>`, which are the implementation counterpart to the `OpDeclaration`s you [passed to the compiler](#a-small-compiler-to-start-with)) as the second argument to `ev`, you implement the actual behavior of such operators.
Let's declare the `+`, for instance :

```js
// The operator reducer. It takes its arguments as a T[], i.e as an array of evaluated (not AST) js objects.
let plusOp = ([a,b]) => a+b 
```

Now let's pass that operator in :


```js
let scriptMacro = ({ ev }, body) => {
    // We can now use '+' !
    let ops = { "+": plusOp }
    let macros = {}

    for (let expr of body) {
        // Here, the body is evaluated, and every time a '+' is encountered, 
        // it will add its operands together !
        ev(expr, ops, macros)
    }
}
```

Notice how operators don't need to evaluate their arguments before adding them ? That's because the compiler automatically `ev`s any argument to an operator. The reducer of an operator therefore takes a `T[]`, and not a `AST[]`.

### More. Macros.

There's still that pesky ```let macros = {}``` line, which is later passed to `ev` along with operators. What is it supposed to mean ?  

Macros are reaaaally powerful, so it would be a shame to just use them to evaluate the script. I gave you the macro syntax :

```
macroName (arg1; ...; argn;) {
    statement1;
    ...;
    statementn;
}
```

When you ask the compiler to evaluate an AST representing a macro, it searches up for the corresponding macro, and evaluates it by calling its reducer with `AST[]`s corresponding to its body and head.

The return type of the macro reducer is used as the return type of the whole macro expression. 

Back to the `macros` passed to `ev`. It is simply meant to give the compiler the implementation of macros that you will use in your script !

For example, let's write a macro that acts like a JS `if` : it should evaluate its single argument, and evaluate its body only if it is truthy.

```js
// We declare the macro :

let compiler = new MicroCompiler(
    [...], // Operator declarations
    [{ name: "if", arity: 1 }], // Macro declarations
    ...
)

let ifMacro = ({ ev }, body, args) => {
    // args here always have a length of 1 because of the arity check.
    let [condition] = args

    // If `condition` (which is an AST, so it needs to be evaluated) evaluates to true
    if (ev(condition)) {
        // Evaluate body
        for (let expr of body) {
            ev(expr)
        }
    }
}
``` 

We need to pass it down just like `+` when evaluating things inside our script macro :


```js
let scriptMacro = ({ ev }, body, args, limbs) => {
    let ops = { "+": plusOp }
    // We can now use 'if' !
    let macros = { "if": ifMacro }

    for (let expr of body) {
        ev(expr, ops, macros)
    }
}
```

We can then use it inside our script like this : 

```
[[ This will evaluate ]]
if (1) {
    1+1;
    2+2;
};

[[ This won't  ! ]]
if (0) {
    0+0;
}
```

And it will behave like a "real" if. Pretty neat, right ?

> If you try to compile the script above, you will get a weird error : `Unknown operator '#number'`. We'll solve that in a minute.

To summarize, the script is handed down to the global script macro, which may, or may not, evaluate its statements using `ev`. When evaluating an expression :
* If it's an operation, then it calls the according operator reducer with its arguments **already evaluated**. 
* If it's a macro, it calls the according macro reducer with its arguments **as ASTs**. It is up to the macro to decide what to do with these.

And there's nothing more to know ! Micro scripts are exclusively constructed with operators and macros, which are then evaluated when needed.

> "But inside the `if` macro, `ev` is called without any operators or macros passed down. Why ?"

This brings us to the next point : scopes.

### Scoping

This one is pretty simple : A macro inherits, inside of its body, any operators and macros that were already defined outside (we call these _ambient_ operators and macros). So that means that `if` doesn't need to pass again `+` and `if` as arguments to `ev`, and that every operator/macro passed down by the script macro is available globally. Every operator/macro passed to `ev` will be available inside the `if` body, and inside it only.

If an operator/macro **that already exist outside** of the `if` is passed to `ev`, that local implementation will override the ambient one (here again, inside the `if` body only).

Suppose now we have an operator, or macro, we defined outside, and that we want to slightly tweak its behavior.
For example, we want to create a `verbose` macro that prints out "Adding a and b !" every time a `+` is encountered.

We would do it like this :

```js
// Declaration
{ name: "verbose", arity: 1 }

let verboseMacro = ({ ev }, body) => {
    // We override the regular behavior of +
    let localPlusOp = ([a,b]) => {
        console.log(`Adding ${a} and ${b} !`)
        return a+b
    }

    for (let expr of body) {
        ev(expr, { "+": localPlusOp })
    }
}
```

That may seem to work, but there is a problem. If we nest a arbitrary number of `verbose` blocks one inside another, we might expect any `+` inside to print out that much "Adding a and b !". In fact, it won't, because the `+` that gets used is the `+` of the innermost `verbose` macro that just prints it once. Luckily for us, the first `context` argument of macros has that `operators` field containing the reducers of the ambient operators. So we can change our implementation to this instead :

```js
let verboseMacro = ({ ev, operators }, body) => {
    let ambientPlusOp = operators["+"]
    let localPlusOp = ([a,b]) => {
        console.log(`Adding ${a} and ${b} !`)
        return ambientPlusOp([a, b])
    }

    for (let expr of body) {
        ev(expr, { "+": localPlusOp })
    }
}
```

And it will work as intended. The `context` argument also has a `macros` field containing the ambient macros if you need them.

Generally speaking, it's a good practice to :
* Pass in every operator at script level, even it's a dummy implementation that always throw
* Delegate operator implementation to the ambient operator if you don't know what to do with its values. That way, nested macros don't interfere with one another. Eventually, if no one knows what to do, it will be passed to the script macro's operator implementation, and, if needed, will crash.

Same applies for macros : pass in every declared macro reducer at script level, then delegate instead of throwing.

### Micro knows nothing about numbers

Let's solve the weird error about the `#number` operator we mentioned above. The title actually speaks for it : knowing what to do with numbers would be semantics, and Micro don't know anything about semantics !

Numbers inside a Micro script are, in fact, syntactic sugar for something called literals. 

> A literal don't have any equivalent in a script, so I'll use backticks (`) to write them, even if it's no actual syntax.

Literals are, like the name suggests, literal excerpts of the source code. They only exist as ASTs and have no direct in-script equivalent.

What happens when you write `1`, for instance, is that it implicitely generates an AST as if you applied operator `#number` to the literal \`1\`. 

> Once again, you don't need to know how literals are actually represented as ASTs for now. All you need to know is that when you type `1`, an AST of this form is generated for you :
```
        #number
           |
          `1`
```


However, the literal \`1\` is, as you can see, an AST, and operators expect **evaluated ASTs** as arguments. It therefore mean we must be able to evaluate the literal before passing it to `#number` for it to actually produce a true number.

This is where the [lift function](#a-small-compiler-to-start-with) comes into play ! Every time a literal must be evaluated, the compiler calls the lift function (which lifts, or promotes, the literal to a true value to be passed around) with a string, representing the literal, as its argument, and the result is understood as evaluating the literal.

Suppose we now want to actually implement numbers.
* We have to replace the dummy `_ => {}` lift function in our compiler by a true lift function. Since lift takes a string  representing a literal as an argument, and that evaluating a literal can, without too much imagination, return that same string, we'll just return the literal itself : `literal => literal`. So passing in \`1\` (as "1") will return "1".
* We have to implement the `#number` operator, which you will then have to pass to `ev` along with `+`. We will juste parse that "1" to 1.0 with the JS `parseFloat` function.

```js
// Don't forget to declare '#number' with arity 1 to the 
// compiler, and to pass down 
// { '+': plusOp, '#number': numberOp } inside the script macro
// reducer

// This will for the implementation !
let numberOp = ([s]) => parseFloat(s)
```

And this will work just like you expected it to !

> While this may seem like overcomplicating things, this is a deliberate choice made to strictly enforce syntax and semantics separation. Besides, it actually offers tangible benefits, which we'll see later.

### Micro knows nothing about strings and names either

I think you got it : when Micro comes across a string, it calls the special operator `#string` with a literal representing the string (for "Hello world !", it would be \`Hello world !\`) as its sole operand.

Same goes with names, such as `foo` : the `#name` operator is called with \`foo\` as its only operand.

You can declare and implement the `#string` and `#name` operators depending on your needs ; without them, strings and names respectively are not usable inside your script.


## Let's practice I

With everything we've learnt until now, we can already implement a calculator.
The requirements for it are the following : 
* Numbers are, of course, functionnal
* It will have operators '+', '-', '*', '/', working like you'd expect them to.
* Every statement will print out its result
* There will be an `arity: 1` macro called `chain`.

The `chain` macro should do the following : using its argument as the initial `value`, it evaluates the first expression of its body, then binds the result to `value`. It then evaluates the second expression, binds it to `value`, and so on. At the end, it returns `value`. As an example :

```
3 + chain (7) {
    1+value;         [[ Returns 8, value being 7 ]]
    5*value + 3;     [[ Returns 43, value being 8 ]]
    value-4        [[ Returns 39, value being 43 ]]
};
[[ Final result is thus 42. ]]
```

We will use an `error(msg: string)` function, defined by `let error = msg => { throw msg }`

Let's begin by declaring all these things :

> JS
```js 

let compiler = new MicroCompiler(
    [
        [{ name: "#number", arity: 1 }],
        [{ name: "#name", arity: 1 }], // We'll need it for chain
        [{ name: "*", arity: 2 }, { name: "/", arity: 2 }],
        [{ name: "+", arity: 2 }, { name: "-", arity: 2 }],
    ],
    [
        { name: "chain", arity: 1 },
    ],
    literal => literal,
    scriptMacro, // See below
)
```

Then, let's implement our operators :

```js
let plusOp = ([a,b]) => a+b
let minusOp = ([a,b]) => a-b
let timesOp = ([a,b]) => a*b
let divideOp = ([a,b]) => a/b
let numberOp = ([s]) => parseFloat(s)

// Inside the script, but ouside a `chain` block, names have no meaning, so we throw.
let nameOp = ([name]) => error(`Syntax error : ${name}.`)
```

Let's write the chain macro. It may seem like a complicated one, but it actually isn't at all !

```js
let chainMacro = ({ ev, operators }, body, [value]) => {
    // This is intended to override the global #name 
    // implementation. The #name operator
    // will be called everytime a name is encountered,
    // but the only name that should do something is "value".
    // When passed in any other name, we delegate.
    let nameOp = ([name]) => {
        if (name === "value") return value
        else return operators["#name"]([name])
    }

    let ops = { "#name": nameOp }
    let macros = {}

    for (let expr of body) {
        value = ev(expr, ops, macros)
    }

    return value
}
```

It's time to write the script macro. We want to simply evaluate and print everything : 

```js
let scriptMacro = ({ ev }, body) => {
    let ops = { 
        "+": plusOp,
        "-": minusOp,
        "*": timesOp,
        "/": divideOp,
        "#number": numberOp,
        "#name": nameOp
    }

    let macros = { 
        "chain": chainMacro
    }

    body.forEach(expr => console.log(ev(
        expr, 
        ops, 
        chainMacro
    )))
}

```

Aaaand done ! When using `compiler.compile` to compile the following script :

```
2*8;
3/4;
3 + chain (7) {
    1+value;      
    5*value + 3;  
    value-4
}
```

it should print out 16, 0.75, and 42. You can, if you like, write other macros and operators (`**`, for example) to improve that small calculator of yours !

The whole script, in case you need it :

> JS script

```js
let error = msg => { throw msg }

let plusOp = ([a,b]) => a+b
let minusOp = ([a,b]) => a-b
let timesOp = ([a,b]) => a*b
let divideOp = ([a,b]) => a/b
let numberOp = ([s]) => parseFloat(s)

let nameOp = ([literal]) => error(`Syntax error : ${literal}.`)

let chainMacro = ({ ev, operators }, body, [value]) => {
    let nameOp = ([name]) => {
        if (name === "value") return value
        else operators["#name"]([name])
    }

    let ops = { "#name": nameOp }
    let macros = {}

    for (let expr of body) {
        value = ev(expr, ops, macros)
    }

    return value
}

let scriptMacro = ({ ev }, body) => {
    let ops = { 
        "+": plusOp,
        "-": minusOp,
        "*": timesOp,
        "/": divideOp,
        "#number": numberOp,
        "#name": nameOp
    }

    let macros = { 
        "chain": chainMacro
    }

    body.forEach(expr => console.log(ev(
        expr, 
        ops, 
        macros,
    )))
}

let compiler = new MicroCompiler(
    [
        [{ name: "#number", arity: 1 }],
        [{ name: "#name", arity: 1 }],
        [{ name: "*", arity: 2 }, { name: "/", arity: 2 }],
        [{ name: "+", arity: 2 }, { name: "-", arity: 2 }],
    ],
    [
        { name: "chain", arity: 1 },
    ],
    literal => literal,
    scriptMacro,
)

```


## Operators

> "Why'd you write another chapter entirely focused on operators ? Haven't we covered most of it already ??"

Nope we don't. Actually, we didn't talk a lot about operators until now. We'll cover many useful syntactic features here, which are very important to code in Micro.

Did you notice how `Operator` takes in an `arity` argument too ? Until there, we exclusively used _binary operators_ (which means "operators with an arity of two"), but these are not the only ones to exist.

> Remember that operators always need to update their arity accordingly to be used in the ways that will follow !

### 2 is good, but 1 is better.

We can use operators in a unary way by prefixing an expression with said operator. Operator precedences still apply, but only at the right of the operator, as unary operators automatically bind tighter than everything on their left side.

So `1 * +1` is parsed as `1*(+1)` since unary operators bind tighter that everything there is on their left, but `+1 * 1` is parsed as `+(1*1)` since precedence on the right side works normally and `*` binds tighter than `+`. This may seem weird, but it's actually pretty common behavior that is seen in many other languages.

> If this confuses you, don't think too much about it ; it is intended to conform to your intuition.

Notice that the space between `*` and `+` in the first expression is mandatory : `1*+1` would be parsed as the operator `*+` applied to two ones. 

This, combined with hash operators, allows for rather cool syntax reminiscent of python 2.0, with directives-like expressions such as `#print 1*2`. 

> Getting rid of parentheses around `1*2` was achieved by making that `#print` operator low precedence. 

### Ternary (and more) operators

You can't pass more than two operands simultaneously to an operator with the syntax bits we've seen until there. 
I therefore introduce to you the _pack_ syntax.  

The pack syntax is rather simple, and its name comes from the fact it allows to "pack" operands for a single operator. You just need to wrap an expression containing only one type of operator inside brackets. For example :

```
[[ This will apply + to operands 1, 2, 3 simultaneously ]]
[[ Writing 1+2+3 without the brackets would have resulted in + applying to (1+2) and 3 instead. ]]

[1 + 2 + 3];
```

This is called a ternary operator (arity of 3), but you can use the pack syntax to give whatever number of arguments you like, including 2. Also note that an optional trailing operator may be added : 

```
[[ Still valid and does the same thing ]]

[1 + 2 + 3 +]; 
```

This allows, among other things, to use the pack syntax for suffix unary operators : `[1+]` is exactly the same as `+1`.

There's several little catches you might want to be aware of. First, a pair of brackets with only an operand inside or, even worse, nothing inside, are both illegal, since the compiler won't know what operator to use :

```
[]; [[ Whoops ! ]]
[0]; [[ Doesn't work either ]]
```

For the same reason, mixing operators is forbidden : 

```
[ 1 + 2*3 + 4 ]  [[ Syntax error : it's ambiguous whether you want to pack on * or + ]]
[ 1 + (2*3) + 4 ] [[ Works fine. ]]
```

Second, due to the syntax of comments, you must be cautious when nesting one bracket expression inside another. Anytime `[[` is encoutered, the compiler enters comment mode until it finds the matching `]]`. So if you want to write something like this :

```
[[ 1 + 2 + 3 ] + 4 + 5 + 6]
```

You actually need to space out the second bracket :

```
[ [1 + 2 + 3] + 4 + 5 + 6 ]
```

Third and last on our list, you can't make a bracket expression start with an unary operation. Suppose we have declared operators `!`, `&&`, `||` in that order (standard JS boolean operations). If we write :

```
[!false || true]  [[ Wrong but no syntax error, see below ]]
[(!false) || true] [[ Works like you'd expect ]]
```

The first expression would actually yield an AST applying `!` to `(false || true)`, although `!` binds tighter than `||` ! Which brings us to our next point : _prefix pack syntax_ (standard pack syntax being refered to as _infix pack syntax_ when there's an ambiguity).

If the left bracket is immediately (there may be some whitespaces) followed by an operator, it is parsed in prefix mode : every expression (separated by semicolons, last one optional, you know the deal by now) inside the brackets is parsed, then that operator is applied to all of them at once. Writing `[+ 1; 2; 3]` therefore is the exact same as `[1 + 2 + 3]` ! And that's also why `[!false || true]` yields `!(false || true)` : `!` is encountered, the compiler enters prefix mode, `false || true` is parsed, then passed to `!`.

> `[+1]` is by that last rule valid syntax and yields the same as `+1` and `[1+]` ! Down to the bone, choosing which one you want to use mostly is a matter of style, as these three truly are the exact same.

### Nullary operators

Have you ever tried applying an operator to nothing ?

```
#pi;  [[ With #pi an operator taking no operands and returning 3.1415... ]]
```

This will crash, actually, with `Unexpected character ';'` or something similar. This is because it sees `#pi` as an unary operator here, and when it encounters the semicolon, it doesn't understand why there isn't any operand following it.

To call an operator with 0 arguments, you thus need to enclose it in square brackets : `[#pi];` is correct and yields the expected result. 

> While this may seem like somewhat new syntax, this is actually the prefix pack operator doing its job !

### Special operators : `#call` and `#index`

Ever wondered why the `{}` following a macro are not optional ?   
That's actually because they are needed to disambiguate macro syntax from a special operator called... well, `#call`. When an expression of the form `callee(arg1; ...; argn;)` (last semicolon optional) is encountered, `callee` as well as `arg1`, ..., `argn` are parsed, then passed together to the special `#call` operator in that order.

> `callee` can be any expression, and, in particular, it can be a name. `myMacro()` would therefore be parsed as applying `#call` to name `myMacro`, which likely isn't what you want here. Adding `{}` at the end forces the compiler to parse that as a macro, since `(myMacro()) {}` doesn't make sense.

This is actually very cool syntactic sugar !

```
myFunction(1; 2; 3);  [[ Same as [#call myFunction; 1; 2; 3] ]]
```

Note that semicolons tell arguments apart from each other, not comas. Comas are regular operators, and `f(1,2,3)` is actually `[#call f; (1,2,3)]`. This might take some time for you to get used to it.

> Using `#call` without that added syntactic sugar is not considered a bad practice, and you can write `[#call f]` or `#call f` instead of `f()` if you prefer. Writing `[f #call 1 #call 2]` for `f(1; 2)`, on the other hand, is very unclear and therefore not recommanded.

Same goes for `x[arg1; ...; argn;]` (last semicolon optional) with the `#index` operator : it will be translated to `[#index x; arg1; ...; argn]`, so that you can write `myArray[0]` to mean `myArray #index 0`. Neat, isn't it ?

> Don't forget that `#call` and `#index` arity is one more than what you would expect, because the thing that's called/indexed is itself an argument to it. Declaring `#index` with an arity of 1 would actually only allow expressions of the form `x[]` !

Such expressions can be nested : `x[0][1]` is `(x #index 0) #index 1`, `f()()` is `[#call [#call f]]`, and `x[0]()` is `#call (x #index 0)`. If you wish to call/index complex expressions, wrapping them inside parentheses works just fine : `(my #complex expression)[index]`

### String format using `#string`

There is slightly more going on with strings that I told you. In Micro, we have _string formatting_, which takes this form : if a `{` is encountered inside a string, the compiler will try to parse the expression contained between it and the closing `}`. Then, it passes that AST to the `#string` operator, and goes on.

For example, parsing `"1+2 is {1+2} !"`  will result in the following call to `#string` :

```
[#string 
    `1+2 is `; 
    { AST for 1+2 };
    ` !`;
]
```

Due to how string formatting is implemented, arguments to string will always alternate between a literal and a string format argument, starting and ending with a literal, so `"{name} said to me {msg}"` would yield :

```
[#string
    ``;
    { AST for name };
    ` said to me `;
    { AST for msg };
    ``;
]
```

With the empty literals added to conform to that rule. 
Also, formatted strings can (although this is quite uncommon) be nested :

```
"Hi, did I told you that { "{name} said to me {msg}" } ?";
```

If you want to forbid string formatting in your scripts, all you have to do is to declare `#string` with an arity of 1 : any formatted string will result in at least 3 arguments to `#string` because of the alternance between literals and expressions.

## Guess what ? We're not done with macros

Macros are the building blocks of Micro, and that's why Micro adds quite a lot of useful syntactic sugar around them : It's time to talk about the [tweaks in macro syntax](#macros) I mentionned when introducing you to macros in the very beginning.

The syntax bits we'll introduce here allows for... say, questionnable scripts :

```
[[ That's valid ! But it's terribly written, and the syntax used is very confusing  ]]
if x(y) {{
    with { someObject } do { 
        [[ Some code here ]]
    }
}}
```

Macro extended syntax allows for pretty wild things, like the ones you see here, but just because you _can_ doesn't mean you _should_. Think twice before implementing a feature, and, when writing scripts, always seek clarity. If at any point your scripts start to look like the above, it means that something went horribly wrong along the way.

### Macro binding

In standard languages, there often are some kind of declarations (classes, functions, etc), which look like this :

> Python
```python
def f(x, y):
    ...

class A(B):
    ...
```

> JS
```js
function f(x, y) {
    ...
}

class A extends B {
    ...
}
```

The pattern is always the same : create a complex object (function or class), then assign it to a name (f and A, respectively).

While we can't obtain the exact same syntax in Micro, we can mimic it pretty well by using _macro binding_ syntactic sugar and the special `#bind` operator. If we write :

```
myMacro bindingName(arg1; ...) {
    statement1;
    ...
}
```

It is translated by the compiler to :

```
[#bind bindingName; myMacro(arg1; ...) {
    statement1;
    ...
}]
```

> `bindingName` must be a "name", that is `x3`, `foo` or `_myFunction`. I quoted name here, because it has the same syntax but is not actually a name : It will be passed to `#bind` as a literal, like \`_myFunction\`

So if we previously declared macros named `func` and `class`, for example, we would be able to write :
```
func f(x; y) {
    [[ Do things ]]
};

class A(B) {
    [[ Class body ]]
};
```

Translated to :

```
[#bind `f`; func(x; y) { ... }];
[#bind `A`; class(B) { ... }];
```

Cool, isn't it ?

> That's where [that `if x(y) {{ ... }}`](#guess-what--were-not-done-with-macros) came from (why there was two curly brackets will follow later) : it's actually bind syntax translating to ```[#bind `x`; if (y) { ... }]```. Pretty confusing when you expect `x(y)` to be a function call, not even mentioning the fact that binding an `if` that way doesn't particularly make sense.

### Head, body, and limbs

Behold : we're finally about to uncover the truth about that [mysterious `limbs` argument](#macros-again) that is passed to macro reducers !

We earlier wrote an `if` macro that worked pretty well : 

```
if (condition) {
    [[ code here ]]
}
```

While it's all nice and stuff, it lacks something : an else branch. Sure, we could do something like this :

```
if (expr) {
    [[ code here ]]
}

if (#not expr) {
    [[ code here ]]
}
```

But that's really awkward : what if `expr` is super long and we don't want to write it out twice ? And it requires to implement `#not` beforehand.

Fortunately, there is support for something called limbs. Take that beautiful comparison between macros and the human body, which serves no purpose but to convince you the appelation `limbs` makes sense :

```
if (expr) [[ <-- That's the head ]] {
    [[ Here's the body ]]
} else { 
    [[ And here's an 'else' limb ! ]]
    [[ Some code here ]]
}
```

Limbs are additionnal blocks of code following a macro and begining with an identifier (here, "else").

What happens is that when encoutering such an expression, the compiler calls the `if` macro reducer with the good old first three arguments and a fourth one, `{ "else": AST[] }`. 
In the `else` field of that object are all `AST`s corresponding to statements written in the else limb.

If we were to write an `if` macro with an `else` limb : 

```js
// The declaration is slightly different from our previous if
// Here limbs is used to tell that `if` accepts an else { ... } block as a limb
{ name: "if", arity: 1, limbs: ["else"] }

let ifMacro = 
    ({ ev }, body, [ condition ], { "else": elseLimb }) => {
        let [condition] = args
        
        if (expect(bool, ev(condition))) {
            for (let expr of body) {
                ev(expr)
            }
        } else {
            for (let expr of elseLimb) {
                ev(expr)
            }
        }
        
        return create(nothing, undefined)
    }
```

> It is common to refer to macros with limbs by joining together their name and limbs, separed by slashes : `if/else`, for example, would refer to the above macro. It doesn't reflect in the declarations and code however, as the macro is still known as just `if` to the compiler.

Our `if` now evaluates its condition, and executes the according block of code : the main one if it's true, the else one if it's false.

A single macro can declare as many limbs as it wants. 
If `limbs: ...` is not explicitely set inside the macro declaration, it defaults to `[]`. Limbs are pretty flexible and can be used without much restrictions. For example, with a declaration for a macro `try/catch/finally` of `{ name: "try", arity: 0, limbs: ["catch", "finally"]}`, these are all correct :

```
[[ All two limbs in the right order ]]
try {} catch {} finally {};

[[ All two limbs in the wrong order ]]
try {} finally {} catch {};

[[ Missing "finally" limb ]]
try {} catch {};

[[ No limb at all ]]
try {}; 

[[ These by the way demonstrate that limbs can be used to mimic really well control flow structures syntax. ]]
```

If a limb is missing, its corresponding field in the `limbs` argument to the macro reducer is defaulted to `[]`, so these two are **exactly** the same :

```
if { [[ Blah blah ]] }; 
if { [[ Blah blah ]] } else {}; 
```


Don't overestimate limbs : a thing such as python's `elif` cannot be implemented with them (nor implemented at all) in Micro :

```
[[ Not valid Micro syntax ]]

if (cond) {

} elif (cond2) {

} elif (cond3) {

} else {

}
```

First because limbs don't take arguments, so `elif (cond2) { ... }` would make the compiler crash, then because limbs can only appear once, so the second `elif` limb would trigger an error. That doesn't mean limbs aren't powerful ; rather that they're not powerful enough to mimic everything and anything.

> That's the explanation for the [`with { someObject } do { ... }`](#guess-what--were-not-done-with-macros) : It's a `with/do` macro. While it may seem like a creative use of limbs to pass in arguments to macros... well, there already is a clearer way to do so : 

```
with (someObject) {
    ...
}
```

> By using limbs instead of arguments, we loose the arity check, only gaining a little bit of... english-ness ? Thus it's considered very bad practice.

### Silence !

You may have already wondered what curly brackets do when used alone : 

```
[[ What is that ? ]]
{}
```

The answer is : it's in fact a (although very inconspicuous) macro call to a special macro, called the _silent macro_. It's a stylish name for a macro that is actually called "" (empty string).

So a pair of curly bracket, eventually with statements inside, just calls the silent macro with said statements as its body, no arguments and no limbs. 
There is no way to pass in arguments or limbs to the silent macro, and its declaration must therefore always read so : 

```js
{ name: "", arity: 0 } // "limbs: []" is optional
```

You could, for example, use it to implement JSON-like syntax : 

```
{
    a: "foo";
    b: "bar";
    c: {
        hello: "World !";
        list: [1, 2, 3,]
    }
}
```

By the way, could you tell the "list literal" is actually the coma operator used in an infix pack ?

> That's what the [`if x(y) {{ ... }}`](#guess-what--were-not-done-with-macros) was : a silent macro nested inside an `if` macro. The silent macro is an expression by itself, and it's better to explicitely space it out from other constructs : 
```
if x(y) { [[ <- that weird head is still bad practice ! ]]
    {
        [[ ... ]]     
    }
}
```

## Back to the forest

I said before that we didn't need to know how `AST`s were implemented, because all we had to do was to pass them to `ev` whenever we wanted to evaluate them.

That's true for most of the cases, but if we want to write complex macros that perform very niche tasks, we might want to directly take a peak at `AST`s instead. 

### AST dissection

An `AST` is actually a plain JS object that always has two fields : `type` and `metadata`. Forget `metadata` for now, and let's focus on `type`. It can take three values, which serve to indicate what the `AST` represents : `"literal"`, `"operation"` and `"macro"`. Depending on that `type`, the `AST` will possess additionnal fields.

* A `literal` describes a literal generated by the compiler. It possesses a `value` field, filled with a string to represent that literal. So \`1\` would be `{ metadata: ..., type: "literal", value: "1" }`, for example.

* An `operation` describes... well, an operation. It has two additionnal fields : `operator` (`string`) and `operands` (`AST[]`). So `1+1` would be : `{ metadata: ..., type: "operation", operator: "+", operands: [{ AST for 1 }, { AST for 1 }] }` (notice how `{ AST for 1 }` would in fact again be an `"operation"` with operator `#number`).

* A `macro` describes a macro call. Its has 4 additionnal fields : `macro`, `body`, `args` and `limbs`, which all contain what you would expect (respectively the macro name as a string, the body as a list of ASTs, the arguments as a list of ASTs, and the limbs as an object whose fields are filled with a list of AST[] for each limb)

And there's nothing more to know ! When `ev` is called on an `AST`, it checks the type, and performs the appropriate action : lifting a literal, applying the operator or calling the macro reducer.

> "Wait, if it's that simple, can I create ASTs myself ?"

Yup ! You could even evaluate `AST`s yourself, for that matter !

### Intrinsic

We'll use a lot the `intrinsic(msg?)` function from the `./ast.js` module. 
From the documentation : 

> Indicates that this macro/operator is implemented using AST manipulation rather than reducers.   
Returns a reducer that throws with `msg` if actually called.  
@errorMsg - The error message in the case it's called, defaults to "Internal error."

It is meant to be used like this :

```js
let someMacro = intrinsic()
let someOperator = intrinsic("The #some operator should not be used here.")
```

It means that every correct occurence of this macro/operator inside the script AST will be replaced before being evaluated, or will never be evaluated at all, and therefore doesn't need to be actually implemented. A call to the reducer returned by instrinsic always results in an error.

### Expect

To demonstrate why direct AST manipulation can be useful, let's write a `switch` macro : 

```
switch (x) {
    case (1) {
        [[ Do something here if x == 1 ]]
    }
    case (2) {
        [[ Do another thing if x == 2 ]]
    }
    default {
        [[ If x is neither 1 nor 2, do that ]]
    }
}
```

As you can see, we didn't use limbs because one single `case` could be written, which would be pretty useless. `switch` instead will use two macros, `case` and `default`, as well as AST manipulation.

We will need the `expect(type, ast, check?)` function (also from the `"./ast.js"` module). From the documentation : 

> Checks that `ast` is of the correct type and that its passes `check`, then returns it.  
 @param type - The expected type of AST  
 @param ast - The AST to check  
 @param check - An additional check defaulting to `ast => true`  

```js
// Macro declarations
{ name: "switch", arity: 1 }
{ name: "case", arity: 1 }
{ name: "default", arity: 0 }

// Operator declaration : switch implicitely use ==
{ name: "==", arity: [2, Infinity] }

let equalsOp = /* Implement it as you like */

let caseMacro = intrinsic("'case' can only be used as a top level statement inside a switch block.")
let defaultMacro = intrinsic("'default' can only be used as a top level statement inside a switch block.")

let switchMacro = ({ ev, operators }, body, [value]) => {
    let ambientEqualsOp = operators["=="]

    let found = false
    for (let expr of body) {
        // The body *must* be `case` and `default` macros only. If it isn't, that's an error.
        // We use the expect function to explicitely check that.
        let { macro, body, args } = expect(
            "macro", 
            expr, 
            ({ macro }) => macro === "case" || macro === "default"
        )

        switch (macro) {
            case "case":
                let [comparable] = args
                let same = ambientEqualsOperator([ev(comparable), ev(value)])
                if (same) {
                    for (let expr of body) ev(expr)
                    found = true
                }
            
            case "default":
                for (let expr of body) {
                    ev(expr)
                }
                found = true
        }

        if (found) break
    }
}
```

And we've got a functional `switch` macro ! Which also proves that AST manipulation is actually pretty simple.

### Replace

Let's do something else. In some languages, there is the possibility to quote some code blocks, producing an usable object representing that code to be passed around. We are gonna do pretty much that, by implementing two things :

* An unary `'` operator, called "quote", that will produce such quoted code blocks.
* An unary `!` operator, called "eval", which will compile any string passed to it and return the result.

The problem here is : operators have access to their elements already evaluated, but `'` clearly need to access the `AST`s to do its job. How can we solve that ? By using `AST` manipulation ! We will need the `replace(type, f, ast, depth?)` function (always from that `./ast.js` module). Here's the doc : 


> Replaces every sub-AST of matching `type` inside `ast` until `depth` with the result of applying `f` to it. 
Replacement is done in a bottom-to-top fashion, so ASTs passed to `f` can have some of their members already replaced.  
@param type - The type of AST that should be replaced  
@param f - The function to apply  
@param ast - The ast on which replacements should be performed.  
@param depth - The maximum depth until which replacement should be performed in termes of nested macros, defaulting to Infinity


```js
// Declarations. Quote should be low precedence to allow quoting entire expressions.
{ name: "'", arity: 1 }
{ name: "!", arity: 1 }

// Quotes won't actually ever be evaluated.
let quoteOp = intrinsic()

// The eval operator can actually be normally implemented
// `compiler` being, of course, our compiler
let evalOp = ([code]) => compiler.compile(code)

// We're gonna manipulate our ASTs inside the whole script, so we implement it in the script macro.
let scriptMacro = ({ ev }, body) => {
    let ops = { "'": quoteOp, "!": evalOp }
    let macros = {}

    // We will replace every occurence of the quote operator with a string representing 
    // the source code of its operand, which we can find in its `metadata.excerpt` field.
    body = body.map(ast => replace(
        "operator", 
        ast => {
            if (ast.operator !== "'") return ast
            else return {
                type: "operation",
                operator: "#string",
                operands: [{
                    type: "literal",
                    // ast.operands[0] is the sole argument to the quote operator.
                    value: ast.operands[0].metadata.excerpt
                }]
            }
        },
        ast
    ))

    for (expr of body) {
        ev(expr, ops, macros)
    }
}
```

We can then use our quote operator so (assuming `#print` is an unary operator that prints its argument to the console): `#print '( 1+1*33 )` will print `1+1*33`, and `! '( 1+1*33 )` will (well, here again assuming the `*`, `+` and `#number` operators have been correctly defined and implemented) evaluate to 34.

> If you wonder what is the use of quoting a block of code instead of simply writing "1+1*33", the quote operator actually checks for the syntax of its argument, including arities, since it is first parsed and only after translated to a string. Also, writing strings would have been a far less interesting example.

### AST metadata & errors

We briefly mentionned `AST.metadata.excerpt`, but there's a little bit more to know about `AST.metadata` than just that. It's an object of type `ASTMetadata` (who'd have guessed that ?) that comes with every `AST` and possesses three fields :

* `excerpt` : We've already seen that one. It's the excerpt of the source code that, once parsed, resulted in that AST. `excerpt` retains the whitespaces, linebreaks and comments that were present inside the original code.

* `src` : The whole script source that was passed in to `MicroCompiler.compile`.

* `loc`: An integer representing the index of the character at which `excerpt` occurs in `src`. You can get the index of the character at which ends `excerpt` with `loc + excerpt.length` (obvious, but worth saying).

Aside from being useful for implementing operators like the quote one above, metadata is great to generate meaningful errors messages. 

Compare :
```
Can't add a number and a string.
```

And :

```
At (12, 13) : " 'hi"+3' : 
Can't add a number and a string.
```

The second is much more informative, and makes debugging far easier. It's that kind of error messages that Micro generates, and it's made possible by the fact `AST`s carry their metadata with them.  
Any error you throw when evaluating your script automatically gains a stack trace, with one level of depth per line. For example, if the nullary operator `#error` always throw `"An error occured"`, that code :

```
if (true) {
    do {
        3+[#error];
    }
}
```

Would result in `MicroCompiler.compile` crashing with the following error message (might slighlty vary over versions):

```
At (1, 1) : "if (true) {" :
At (2, 5) : "do {" :
At (3, 9) : "3+[#error]" :
At (3, 11) : "[#error]" : 
An error occured.
```

You can yourself throw errors with `throwWith(metadata, msg)` from `./ast.js`. The docs, as always :

> Throws `msg` with a header summarizing `metadata`  
@param metadata - Info on where the error happened  
@param msg - The error message

While the metadata you pass to it can, technically speaking, be created, it's really, really not recommanded, and it's a lot better to use the metadata of the AST the error, semantically speaking, occured in. Note that this is only useful to throw errors about `AST`s you are manipulating and not evaluating. For those you evaluate, you can just throw some classic string inside the reducer, and it will automatically gain  headers when the error bubbles up.

### With great power comes great responsability

Just like macros extended syntax, AST manipulation allows for cool, but also very wild things. So, once again, _can doesn't mean should_, and you must always think about a reducer-based solution before going all in with `replace`. Also, `replace` traverses the whole `AST`, and using it extensively can result in performance issues. 


## Conclusion

Congratulations, you've made it to the end ! I hope Micro convinced you, and that this tutorial was clear enough.  
There is plenty of things you can do with it, from describing complex data structures to using it as a small imperative language ; and probably a lot of other things I didn't yet think about. 

At the time I'm writing this, I nearly began experimenting with that language. There's cool things that came out without me noticing in the first place (nullary operators, for example, had their own syntax, before I found out that prefix packs worked really well with them, and I had to find for myself that I actually had list literals backed into the language with `,` + the infix pack syntax). I hope there will be others.  

I use this tool in my projects, so it will be maintained and updated whenever I feel it is necessary. The whole ambient operators/macros thing didn't exist before I wrote some code myself and told me 'uh, that's painful to keep track of which operators do what', scoping used to work in a far less efficient way in earlier versions, and macro binding was implemented because I was sick of having to write ugly things like `"f = function() { ... }"` all the time. I do my best so that this language stays easy and pleasant to use, and I hope that it will suffice. If you have any suggestions about the syntax or the way Micro works, you can mail me at `alphasaft.github@gmail.com`. 

I wish you a great day,  
Alphasaft
