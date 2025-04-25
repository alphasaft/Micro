
# The basics

## A small parser to begin with 
 
The very beginning of our journey starts with the creation of a compiler. For that, we need to import both the `MicroParser` class and the `MicroCompiler` ones in a JS file, and to write the following

> myCompiler.js
```js
class DemoParser extends MicroParser {
    constructor() {
        super({
            operators: [],
            macros: []
        })
    }
}

class DemoCompiler extends MicroCompiler {
    parser = new DemoParser()
}

let compiler = new DemoCompiler()
```

This `compiler` will be the object we will use to read our scripts, and then output an object that will be generated using the directives present in said script. You can ask it to run a script with `compiler.run(script: string)`. But what is `script` supposed to look like ?

## Writing our first Micro script

A Micro script consists solely of a list of _expressions_. We separe expressions by semicolons, the last one being optional, and the script may include comments anywhere. These may be inline comments, begining with `##` and ending with the end of the line, or block comments wrapped inside a `#- ... -#` pair.

This is one of the smallest scripts you could ever write : 

```
1+1;  ## Note that this ';' is optional, as 1+1 is the last expression
```

Whitespaces and line returns are ignored, so this is perfectly valid :

```
1
+    1;  ## Works !
```

Of course, you can stack multiple expressions on top of one another :

```
#- And that's three ! -#
(1+1)*2;
2*3+4;
77+63
```

## Expressions

Let's talk a little bit more about what an expression is. It consists of things (called operands), bound together by operators. An expression may also be a single operand. 

Operands can be one of the following :
* A literal. This can be a string (characters enclosed inside quotes, such as `"Hello world !"`), a number (`1` or `2.0` for instance), or a name (a letter or underscore, followed by letters, underscores and digits : `x`, `true` and `_list2` are names). Literals are the "elementary blocks" of your script, in that that they can't be split into smaller components.

* Another expression, eventually parenthesized.

* A macro (the syntax of which I will tell you later on)


> `8`, `1+"hi"`, `x*y-z` and `1+(2*"hello")` are all valid expressions. Can you tell how they were built ?


There's one very, very important thing you need to have in mind before going any further. We distinguish three concepts :  
* An _operation_ is the result of applying an operator to some other things, called operands. `1+1` is an operation, with the operator being `+` and the operands being two `1`.  
* An _expression_, on the other hand, can contain several operations. `1+1*1`, for example.
* A _statement_ is the designation given to a top-level expression, that is an expression that's followed by a semicolon and stands for itself. Syntactically speaking, statements and expressions are exactly the same thing, so we'll stick with "expressions" for both here.

An operation is pretty straightforward to understand when we see it : `1+1` is applying `+` to 1 and 1, period. However, for an expression, the whole thing is thougher. Take `1+1*1`, for example. Here, it's `+` and `*`, so we know, because we're used to them, that `*` comes before `+` and so the expression must be interpreted as `1+(1*1)`. But what if the operators had weird names like `@` and `||` ?

That's why you **always** have to tell yourself the parser how expressions should be interpreted ; which brings us to the operator declarations. When initializing the `MicroParser`, you have to pass an `operators` field, which has type `OpDeclaration[][]` (a list of lists of operator declarations). It takes the following form :

```js

class DemoParser extends MicroParser {
    constructor() {
        super({
            operators: [
                [{ name: "*", arity: 2 }],
                [{ name: "+", arity: 2 }, { name: "-", arity: 2 }],
                // Some other operators 
            ],
            macros: []
        })
    }
}
```

and serves three purposes :

* To tell the parser that `*`, `+` and `-` are the allowed operators in our scripts. Using any other operator will trigger an error.

* To set the operators arity. Here, they all have an arity of `2`, meaning that they expect two operands to work with. You might also use a two-element list, such as `[1,3]`, to tell that it can work with 1 up to 3 operands (both endpoints are inclusive). We will see exactly how an operator can take more or less than 2 operands in chapter III.

* To say that `*` has higher precedence (we also say it binds tighter), because it stands higher, than `+` and `-`, which have the same precedence than one another (because they stand in the same sublist)

So it means that when the parser encounters `1+1*1`, it knows `*` has higher precedence, and hence that it means `1+(1*1)`.

> If you need to override precedence and execute `+` before `*` in an expression, you need to enclose it in parentheses : `(1+1)*1`.

If several operators with the same precedence are encountered in a single expression, the one at the left binds first, then the second, and so on. With the above declarations, `1+1-1+1` therefore executes as `((1+1)-1)+1`. When the same operator is encountered several times in a row, as in `1+2+3`, something special happens - we'll cover that in a minute.

## Be verbose

Symbolic operators do the trick most of the time : you have two numbers, you want to add them, you use `+`. 
But there is times where keywords would be handy. For example, to test if an object is in a list, `elem in list` is far nicer than any `elem >?> list` shenenigans. While we can't exactly do that in Micro, we instead got something that very closely ressembles it : hash operators. These are operators that start with `#` (hence the name), followed by one or more letters : `#foo` or `#bar` for instance.  These are used just like normal, symbol-based operators, and allow for nicer syntax when needed.

> If you wonder, here are the symbols that can be used in symbolic operators : `&|~^@=+-$*%!/:.,?!<>`. Any combination of such symbols is a valid operator ; note that `#` is not. Especially, it means `#-` isn't an operator, and that's a good thing, because it is already used for comments !

I repeat one more time, because it's quite important and easy to miss : **hash operators do not differ from standard operators like `+`, and it's only a matter of stylistic preference.**

## Macros

Let's come back to the last type of operands : macros. I mentionned them, but I didn't explain how to write one ; let's fix that. For now, you can view a macro as a way to control how a block of code is executed. The general syntax for a macro is the following (plus several tweaks we'll talk about later) :

```
macroName(arg1; arg2; ...; argn;) {
    statement1;
    ...
    statementn;
}
```

Which is much more complicated than anything we've seen until there, but bear with me. The thing between parentheses is called the argument list (or head), the thing between curly brackets is known as the body. `arg1` (etc) as well as `statement1` (etc) should be valid expressions. For both lists, the final semicolon is optional.

Note that the formatting (the line return after the first curly bracket, the indent, etc) is purely a question of style since spaces and line returns are ignored, and that this is fine as well :

```
macroName(
    arg1; 
    arg2;
    arg3;
) { statement1; statement2 }
```

`macroName` must have been declared through [the `macros` field of the parser](#a-small-parser-to-begin-with). For example, if you want to declare a macro called `doSomething` that takes in one argument, you'd have to write this : 

```js

class DemoParser extends MicroParser {
    constructor() {
        super({
            operators: ...
            macros: [{ name: "doSomething", arity: 1 }],
        })
    }
}

```

With `arity: 1` meaning that our newly created macro takes one single argument, just like with operators. An arity check is automatically performed every time this macro is encountered, so this would crash :

```
#- Fails with "Macro doSomething at most 1 argument(s), got 2." -#
doSomething (x; y) {

};
```

You can add some flexibility to the number of arguments accepted by passing in a two-sized list instead : `arity: [a,b]` means the macro accepts between a and b arguments, inclusive at both endpoints.

Always remember that macros are still expressions, and, as such, this is valid syntax :

```
#- Multiplying 1 by the result returned by myMacro -#
1 * myMacro(...) { ... };

#- And to remind you hash operators exist : -#
hello #is mySecondMacro(...) { ... };
```
