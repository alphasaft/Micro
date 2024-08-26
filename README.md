# The ITA Compiler

The ITA Compiler is a tool for creating efficient DSLs (Domain Script Languages), allowing you to describe whatever data you'd like in a elegant and concise way.

It is written in Javascript, and requires you to know the basics of this language before you can use it (You can learn Javascript [here](https://www.learn-js.org/)). Furthermore, I will often use typescript syntax to describe what types are expected.

Without further ado, let's get started !

## The basics

### A small compiler to start with 

The name ITA stems from a private joke I have with some friends, but let's pretend it comes from Iterative Transformation Apparatus. 

We first need to create what's called an ITA compiler. For that, you need to import the `ITACompiler` class, as well as the `Macro` and `Operator` classes, in a JS file, and to write the following

> myCompiler.js
```js
let compiler = new ITACompiler(
    ["*", "+"],
    _ => {},
    new Macro("script", 0, () => {}),
)
```

The arguments passed to the `ITACompiler<T>` constructor work as follow :
- A `(string | string[])[]`, which serves as the operator declarations. Here, we declare the `+` and `*` operators.
- A `(literal: string) => T` function, called _lift_.
- A `Macro<T>`, known as the _script macro_.

Don't worry about what these means, we'll come back to it later. Just know that you thereby defined your own compiler, that will compile your own version of the ITA language.

You can compile any valid ITA script with `compiler.compile(src)`. 

### Write an ITA script

ITA is a small language (or, to be accurate, a set of languages, but we'll see about that later) that has a pretty simple, yet very volatile syntax. An ITA script consists solely of a list of _expressions_. We separe expressions by semicolons, the last one being optional, and the script may include comments, wrapped inside a `[[ ... ]]` pair.

This is one of the smallest scripts you could ever write, yet it's perfectly valid :

```
1+1; [[ Note that this ';' is optional, as 1+1 is the last expression ]]
```

Every operator you declared previously might be used, but any other operator will induce a syntax error :

```
1-1; [[ This will crash with "Unknown operator '-'." ]]
```

Whitespaces and line returns are ignored, so this is perfectly valid :

```
1
+    1;  [[ Works ! ]]
```

### Expressions

Let's talk a little bit more about what an expression is. It consists of things (called operands), bound together by operators. An expression may also be a single operand. 

Operands can be one of the following :
* A literal. This can be a string (characters enclosed inside quotes, such as `"Hello world !`), a number (`1` or `2.0` for instance), or a name (letters, `x` or `true` are names). Literals are the "elementary blocks" of your script, in that that they can't be split into smaller components.

* Another expression.

* A macro (which we will talk about later)


> `8`, `1+"hi"`, `x*y*z` and `1+(2*"hello")` are all valid expressions.


There's one very, very important thing you need to have in mind before going any further. We distinguish three concepts :  
* An _operation_ is the result of applying an operator to some other things, called operands. `1+1` is an operation, with the operator being `+` and the operands being two `1`.  
* An _expression_, on the other hand, can contain several operations. `1+1*1`, for example.
* A _statement_ is the designation given to a top-level expression, that is an expression that's followed by a semicolon and stands for itself. Syntactically speaking, statements and expressions are exactly the same thing, so we'll stick with "expressions" for both here.

An operation is pretty straightforward to understand when we see it : `1+1` is applying `+` to 1 and 1, period. However, for an expression, the whole thing is thougher. Take `1+1*1`, for example. Here, it's `+` and `*`, so we know, because we're used to them, that `*` comes before `+` and so the expression must be interpreted as `1+(1*1)`. But what if the operators had weird names like `@` and `||` ?

That's why you **always** have to tell yourself the compiler how expressions should be interpreted. Remember when we passed `["*", "+"]` as an argument to the compiler ? Beside declaring our operators, it also means that whenever there is an ambiguity, `*` has a higher _precedence_ (since it stands before) than `+` (we also say `*` _binds tighter_ than `+`) and should be executed first. So, when the compiler encounters `1+1*1`, it knows that it means `1+(1*1)`.

> To declare two operators with the same precedence, you would wrap them in a list, like so : `["*", ["+", "-"]]`. Here `*` binds tighter than `+`, which binds as tight as `-`.

If several operators with the same precedence are encoutered in a single expression, the one at the left executes first, then the second, and so on. `1+1+1+1` therefore executes as `((1+1)+1)+1`.

> If you need to override precedence and execute `+` before `*` in an expression, you need to enclose it in parentheses : `(1+1)*1`.

### The long-awaited list of keywords

Now for the the list of all keywords of the language : 

No keywords, actually ! Instead, we got hash operators. These are operators that start with `#` (hence the name), followed by one or more letters : `#hello` or `#world` for instance.  These are used just like normal, symbol-based operators, and allow for nicer syntax when needed : `elem >?> myList` is pretty obfuscated, while `elem #in myList` is crystal clear !

> If you wonder, here are the symbols that can be used in symbolic operators : `&|~^@=+°$*%!§/:.,?!<>`. Any combination of such symbols is a valid operator.

I repeat : these do not differ from standard operators like `+`, and it's only a matter of stylistic preference.

### Macros

For now, you can view a macro as a block of code, and a way to group several expressions.
The general syntax for a macro is the following (plus several tweaks we'll talk about later) :

```
macroName(arg1; arg2; ...; argn;) {
    statement1;
    ...
    statementn;
}
```

Which is much more complicated than anything we've seen until there, but bear with me.  
The thing between parentheses is called the argument list, the thing between curly brackets is known as the body.

`arg1` (etc) as well as `statement1` (etc) should be valid expressions. For both, the final semicolon is optional.
If the argument list is empty, parentheses can be dropped, so this is valid syntax :

```
macroName { 
    [[ Some expressions here ]]
}
```

However, even if there are no expressions inside the body, the curly brackets aren't optional.
Note that the formatting (the line return after the first curly bracket, the indent, etc) is purely a question of style, and that this would be fine :

```
macroName(
arg1; arg2;
    arg3;
) { statement1;                 statement2 }
```

For obvious reasons this however isn't recommanded.

As I mentionned before, macros are still expressions, and, as such, this is valid syntax :

```
1 * myMacro(...) { ... };
[[ And to remind you hash operators exist : ]]
hello #is mySecondMacro(...) { ... };
```

## Syntax versus semantics

You may have noticed that until now I only talked about what you could _write_, not about what it actually _does_.  The first thing is usually called the syntax of a program, the second its semantics.

**This** is actually what makes ITA stands apart from other languages. It's only a syntax. No semantics. If you compile a script, it actually does... nothing !

```js
compiler.compile("1+1*1;")
// Prints nothing, returns void.
```

> "But... wait ! I do want my code to do something, somehow !".   

Me too ! That's where it gets interesting. Remember the two other arguments we passed to the compiler ? It's time to actually understand what they do.

### Go touch some grass

First, let's talk about trees. 
In a typical programming language, before doing anything with a script, said script is usually translated in a much more practical form, called an _Abstract Syntactic Tree_ (or AST), and ITA is no exception to that.

Behind this daunting name hides a rather simple thing. Here's what it means. When you write `1+(2*3);`, for example, it's translated to something that roughly looks like `{ op: '+', args: [1, { op: '*', args: [2, 3] }] }`. It appears uglier, but it's now standard javascript and, as such, it's much easier for a program to manipulate it.

> The name comes from the fact you can represent it like so :

```
    +
   / \
  1   *
     / \
    2   3
```

> Which, if flipped, looks (somewhat, don't expect an computer scienticist to know what a tree is) like a tree.
                     
In standard languages, it's, more often than not, **not** visible by the user, and directly used by the compiler to perform actions. In ITA, however, once the ASTs for the whole script are obtained (we say the script has been _parsed_), it's passed down to **you**, so you can do whatever you want with it.

> We don't need to understand how ASTs are implemented for now, but we'll talk about it later.

### Macros, again

And that's where macros kick in ! Conceptually, macros are functions that are meant to execute parsed code. The constructor of a `Macro<T>` takes three required arguments :
* A `string`, its name, by which it will be refered,
* A `number | [number, number]`, its arity, which indicates how many parameters it takes ; we'll come back to that later,
* A very complicated `(ev: Evaluator<T>, body: AST[], args: AST[], limbs: { [limb: string]: AST }) => T` function called the _reducer_. That's the most important component of a macro.

> There's actually an optional fourth argument, but we will leave it for now.

When you write code, and once it has been translated into ASTs, it's passed to the script macro you gave to the compiler. 
It calls the reducer with these args :
* An evaluation function, `ev`
* The whole script as a list of `AST`s.
* An empty list (don't worry about it)
* An empty object (don't worry about it)

Each AST of the list is one expression inside your script. So if your script was `1+1; 2+2; 3+3;`, it has a length of 3. 


> From now on, a `T` will keep popping in signatures. That's the same `T` there is in `ITACompiler<T>`, and it means a compiler (along with its operators and macros) must manipulate one single data type. We just bypass that restriction for now by using `T = any`, allowing us to pass in `void`, `number`s and `string`s as we like

The magic resides inside the `ev` function. 
Its signature is `(ast: AST, operators: Operator<T>[] = [], macros: Macro<T>[] = []) => T`, and here's how you use it. Suppose we just want to evaluate sequentially every expression inside your script. We would write :

```js
let scriptMacro = new Macro(
    "script", // The script macro's name's script by convention.
    0, // Like I said, this is for later
    (ev, body, args, limbs) => {
        // See below
        let ops = []
        let macros = []

        // We iterate throught each expression
        for (let expr of body) {
            // And evaluate it !
            ev(expr, ops, macros)
        }

        // There's no return value, so that macro returns void
    }
)
```

And that's done ! Well, almost. Remember how I said that the ITA compiler has absolutely no idea about semantics ? That still holds. So how would it know that `+` adds two numbers and `*` multiplies them ?

By passing in operators (of type `Operator<T>[]`) as the first argument to `ev`, you implement the actual behavior of such operators.
Let's declare the `+`, for instance :

```js
let plusOp = new Operator(
    "+", 
    2, // An arity of 2 means + takes two arguments, just like in a+b
    ([a,b]) => a+b // The operator reducer. It takes its arguments as a T[].
)
```

Now let's pass that operator in :


```js
let scriptMacro = new Macro(
    "script", 
    0, 
    (ev, body, args, limbs) => {
        // We can now use '+' !
        let ops = [plusOp]
        let macros = []

        for (let expr of body) {
            // Here, the expressions are evaluated, and every time a '+' is encountered, 
            // it will add its operands together !
            ev(expr, ops, macros)
        }
    }
)
```

Notice how operators don't need to evaluate its arguments before adding them ? That's because the compiler automatically `ev`s any argument to an operator. The reducer of an operator therefore takes a `T[]`, and not a `AST[]`.

### More. Macros.

There's still that pesky ```let macros = []``` line, which is later passed to `ev` along with operators. What is it supposed to mean ?  

Macros are reaaaally powerful, so it would be a shame to just use them as the script macro. I gave you the macro syntax :

```
macroName (arg1; ...; argn;) {
    statement1;
    ...;
    statementn;
}
```

When you ask (using `ev`) to evaluate an AST containing such a expression, it looks up for a macro named `macroName`, and calls its reducer with the following arguments :

* Our beloved `ev` function, unchanged
* The ASTs corresponding to `statement1`, ..., `statementn`, in a list, as the `body` argument.
* The ASTs corresponding to `arg1`, ..., `argn`, in a list, as the `args` argument.
* An empty object as the `limbs` argument (still don't worry about that last one. I assure you, we will use it in due time)

The compiler also performs an arity check : the second argument of a Macro tells how many arguments it expects. `6` would mean "exactly six arguments", while `[1,3]` is "from 1 to 3 arguments" (inclusive at both endpoints). "2 or more arguments" would be `[2,Infinity]`. If there's too much or too few arguments, the compiler will crash automatically.

The return type of the macro reducer is used as the return type of the whole macro expression. 

> Note, with that in mind, that what the compiler actually does with any of your scripts is wrapping it in a `script { ... }` macro, and then evaluate it implicitely. Nothing more ! This also explains why the arity argument of the script macro must always be 0.

Back to the `macros` passed to `ev`. It is simply meant to give the compiler the implementation of macros that you will use in your script !

For example, let's write a macro that acts like a JS `if` : it should evaluate its single argument, and execute only if it is truthy.

```js
let ifMacro = new Macro(
    "if",
    1, // One single argument
    (ev, body, args) => {
        // args must have a length of 1 because of the arity check.
        let [condition] = args

        // If `condition` (which is an AST, so it needs to be evaluated) evaluates to true
        if (ev(condition)) {
            // Execute body
            for (let expr of body) {
                ev(expr)
            }
        }
    }
)
``` 

We need to pass it down when evaluating things inside our script macro :


```js
let scriptMacro = new Macro(
    "script", 
    0, 
    (ev, body, args, limbs) => {
        let ops = [plusOp]
        // We can now use 'if' !
        let macros = [ifMacro]

        for (let expr of body) {
            ev(expr, ops, macros)
        }
    }
)
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
    0*0;
}
```

And it will behave like a "real" if. Pretty neat, right ?

> If you try to compile the script above, you will get a weird error : `Unknown operator '#number'`. We'll solve that in a minute.

To summarize, the script is handed down to the global script macro, which may, or may not, evaluate its statements using `ev`. When evaluating an expression :
* If it's an operation, then it calls the according operator with its arguments **already evaluated**. 
* If it's a macro, it calls the according macro with its arguments **as ASTs**. It is up to the macro to decide what to do with these.

And there's nothing more to know !

> "But inside the `if` macro, `ev` is called without any operators or macros passed down. Why ?"

This brings us to the next point : scopes.

### Scoping

This one is pretty simple : A macro inherits, inside of its body, any operators and macros that were already defined outside. So that means that `if` doesn't need to pass again `+` (or even `if` itself !) as arguments to `ev`, and that every operator/macro passed down by the script macro is available globally.

Every operator/macro passed to `ev` will be available inside the `if` body, and inside it only.

If an operator/macro **that already exist outside** of the `if` is passed to `ev`, the new implementation will override the outside one (here again, inside the `if` body only). If it's the exact same implementation, it's useless.

### ITA knows nothing about numbers

Let's solve the weird error about the `#number` operator we mentioned above. The title actually speaks for it : knowing what to do with numbers would be semantics, and ITA don't know anything about semantics !

Numbers inside an ITA script are, in fact, syntactic sugar for something called literals. 

> A literal don't have any equivalent in a script, so I'll use backticks (`) to write them, even if it's no actual syntax.

Literals are, like the name suggests, literal excerpts of the source code. They only exist as internal ASTs.

What happens when you write `1`, for instance, is that it implicitely generates an AST as if you applied operator `#number` to the literal \`1\`. 

However, that literal is, like anything else, an AST, and operators expect **evaluated ASTs** as arguments. It therefore mean we must be able to evaluate the literal before doing anything with it.

This is where the lift function comes into play ! Every time a literal must be evaluated, the compiler calls the lift (which lifts, or promotes, the literal to a true value to be passed around) function with a string, representing the literal, as its argument, and the result is returned.

Suppose we now want to actually implement numbers.
* We have to replace the dummy `_ => {}` lift function in our compiler by a true lift function. Since lift takes a string  representing a literal as an argument, and that evaluating a literal can, without too much imagination, return that same string, we'll just return the literal itself : `literal => literal`
* We have to implement the `#number` operator, which you will then have to pass to `ev` along with `+`.

```js
// This will do !
let numberOp = new Operator(
    "#number",
    1,
    s => parseFloat(s),
)
```

And this will work just like you expected it to !

> While this may seem like overcomplicating things (and maybe is), this was done to strictly ensure syntax and semantics stay entirely disjoint. Besides, it actually offers tangible benefits, which we'll study later.

### ITA knows nothing about strings and names either

I think you got it : when ITA comes across a string, it calls the special operator `#string` with a literal representing the string (for "Hello world !", it would be \`Hello world !\`) as its sole operand.

Same goes with names, such as `foo` : the `#name` operator is called with \`foo\` as its only operand.

You can implement the `#string` and `#name` operators depending on your needs ; without them, strings and names respectively are not usable inside your script.


### A sample script

I put here everything we've seen until now, so that you see how everything works together !

> JS
```js 
let plusOp = new Operator(
    "+",
    2,
    ([a,b]) => a+b
)

let timesOp = new Operator(
    "*",
    2,
    ([a,b]) => a*b
)

let numberOp = new Operator(
    "#number",
    1,
    s => parseFloat(s),
)

let ifMacro = new Macro(
    "if",
    1,
    (ev, body, args) => {
        let [condition] = args
        if (ev(condition)) {
            body.forEach(expr => ev(expr))
        }
    }
)

let scriptMacro = new Macro(
    "script",
    0,
    (ev, body) => {
        let ops = [numberOp, timesOp, plusOp]
        let macros = [ifMacro]
        for (let expr of body) {
            ev(expr, ops, macros)
        }
    }
)

let compiler = new ITACompiler(
    ["#number", "*", "+"],  // Don't forget to declare the #number operator !
    literal => literal,
    scriptMacro
)

let src = ...

compiler.compile(src)
```

> ITA sample script

```
1+1;

[[ The body won't evaluate ! ]]
if (0) {
    2*2;
};

[[ 3+3 will evaluate. ]]
if (1) {
    3+3;
};
```


## Operators

> "Why'd you write another chapter entirely focused on operators ? Haven't we covered must of it already ??"

Nope we don't. Actually, we didn't talk a lot about operators until now. We'll cover many useful syntactic features here, which are very important to code in ITA.

Did you notice how `Operator` takes in an `arity` argument too ? Until there, we exclusively used _binary operators_ (which means "operators with an arity of two"), but these are not the only ones to exist.

> Remembre that operators always need to update their arity accordingly to be used in the ways that will follow !

### 2 is good, but 1 is better.

We can use operators in a unary way by prefixing an expression with said operator. That allows for JS-like syntax, for example with `!expr` : `!` here acts as an unary operator applied to `expr`, presumably negating expr.

Operator precedences still apply, but only at the right of the operator, as unary operators automatically bind tighter than everything on their left side.

So `1*+1` is parsed as `1*(+1)` since unary operators bind tighter that everything there is on their left, but `+1*1` is parsed as `+(1*1)` since precedence on the right side works normally and `*` binds tighter than `+`. This may seem weird, but it's actually pretty common behavior that is seen in many other languages.

> If this confuses you, don't think too much about it ; it is intended to conform to your intuition.

This, combined with hash operators, allows for rather cool syntax reminiscent of python 2.0, with directives-like expressions such as `#print (1*2)`. 

> By making `#print` low precedence, you can even get rid of the parentheses ! 

### Ternary (and more) operators

You can't pass more than two operands simultaneously to an operator with the syntax bits we've seen until there. 
I therefore introduce to you the _pack_ syntax.  

The pack syntax is rather simple and comes from the fact it allows to "pack" operands for a single operator. You just need to wrap an expression containing only one type of operators inside brackets. For example :

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

There's several little catches you might want to be aware of. First, a pair of brackets with only an operand inside or even worse, an empty pair of brackets, are both illegal, since the compiler won't know what operator to use :

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

You need to space out the second bracket :

```
[ [1 + 2 + 3] + 4 + 5 + 6 ]
```

Third and last on our list, you can't make a bracket expression start with an unary operation. Suppose we have declared operators `!`, `&&`, `||` in that order (standard JS boolean operations). If we write :

```
[!false || true]  [[ Wrong but no syntax error, see below ]]
[(!false) || true] [[ Works like you'd expect ]]
```

This would yield an AST applying `!` to `(false || true)`, although `!` binds tighter than `||` ! Which brings us to our next point : _prefix pack syntax_ (standard pack syntax being refered to as _infix pack syntax_ when there's an ambiguity).

If the left bracket is immediately followed by an operator, it is parsed in prefix mode : every expression (separated by semicolons, last one optional, you know the deal by now) inside the bracket is parsed, then that operator is applied to all of them at once. Writing `[+ 1; 2; 3]` therefore is the exact same as `[1 + 2 + 3]` ! And that's also why `[!false || true]` yields `!(false || true)` : `!` is encountered, the compiler enters prefix mode, `false || true` is parsed, then passed to `!`.

> `[+1]` is by that last rule valid syntax and yields the same as `+1` and `[1+]` ! Down to the bone, choosing which one you want to use mostly is a matter of style, as these three truly are the exact same.

### Nullary operators

Have you ever tried applying an operator to nothing ?

```
#pi;  [[ With #pi an operator taking no operands and returning 3.1415... ]]
```

This will crash, actually, with `Unexpected character ';'` or something similar. This is because it sees `#pi` an unary operator here, and when it encounters the semicolon, it doesn't understand why there isn't any operand following it.

To call an operator with 0 arguments, you thus need to enclose it in square brackets : `[#pi];` is correct and yields the expected result. 

> While this may seem like somewhat new syntax, this is actually the prefix pack operator doing its job !

### Special operators : `#call` and `#index`

Ever wondered why the `{}` following a macro are not optional ?   
That's actually because they are needed to disambiguate macro syntax from a special operator called... well, `#call`. When an expression of the form `callee(arg1; ...; argn;)` (lAsT sEmIcOLoN OpTiONal) is encountered, `called` as well as `arg1`, ..., `argn` are parsed, then passed together to the special `#call` operator in that order.

> `callee` can be any expression, and, in particular, it can be a name. `myMacro()` would therefore be parsed as applying `#call` to name `myMacro`, which likely isn't what you want here. Adding `{}` at the end forces the compiler to parse that as a macro, since `(myMacro()) {}` doesn't make sense.

This is actually very cool syntax, since function call-like expressions are thereby valid !

```
myFunction(1; 2; 3);  [[ Same as [#call myFunction; 1; 2; 3] ]]
```

Note that semicolons tell arguments apart from each other, not comas. Comas are regular operators, and `f(1,2,3)` is actually `[#call f; (1,2,3)]`. This might take some time for you to get used to it.

> Using `#call` without that added syntactic sugar is not considered a bad practice, and you can write `[#call f]` or `#call f` instead of `f()` if you prefer. Writing `[f #call 1 #call 2]` for `f(1; 2)`, on the other hand, is very unclear and therefore not recommanded.

Same goes for `x[arg1; ...; argn;]` (last semicolon optional) with the `#index` operator : it will be translated to `[#index x; arg1; ...; argn]`, so that you can write `myArray[0]` to mean `myArray #index 0`. Neat, isn't it ?

> Don't forget that `#call` and `#index` arity is one more than what you would expect, because the thing that's called/indexed is itself an argument to it. Declaring `#index` with an arity of 1 would actually only allow expressions of the form `x[]` !

Such expressions can be nested : `x[0][1]` is `[#index [#index x; 0]; 1]`, `f()()` is `[#call [#call f]]`, and `x[0]()` is `#call (x #index 0)`. If you wish to call/index complex expressions, wrapping them inside parentheses works just fine.
