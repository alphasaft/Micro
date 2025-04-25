# We're not done with macros

Macros are the building blocks of Micro, and that's why Micro adds quite a lot of useful syntactic sugar around them : It's time to talk about the tweaks in macro syntax I mentionned when introducing you to macros in the very beginning. First, let's look at how exactly the parser reads a macro. In fact, there's not much going on : it gets ready to read a name (because macros start with what looks like a name), then realizes that name coincides with that of a macro, and proceeds to parse what follows, **expecting a macro**. This has its importance, as it means :

* That a standard name (as in `>> x << = 3`) cannot be the same as a macro name since the compiler will try to read it as a macro, but that was pretty much expected. Naming 'if' a variable is either way a war crime.

* That the syntax can be a lot lighter than the whole `name(...) { ... }` package, because as soon as it sees the macro name, it **knows** that next must come a macro. No need for parentheses or brackets to trigger it.

And that latter point brings us to the next one.


## The Bare Necessities

This was what I told you a macro looks like :

```
macroName(arg1; arg2; arg3) {
    statement1;
    statement2;
    statement3;
}
```

But I lied, because not much of the above is actually mandatory. Firstly, you can (and often should) drop the parentheses when the argument list is empty :

```
#- These are the same -#
myMacro() { ... }
myMacro { ... }
```

Secondly, you may also drop the brackets whenever the body contains a single statement :

```
#- These are the same -#
myMacro(arg) { statement; };
myMacro(arg) statement;
```

A word about how exactly it's done. If no `{` is read after the head, the compiler then tries to parse an expression. It means that it will stop at the end of said expression, but not that it requires a semicolon to do so, nor that it will consume that semicolon. If you use a semicolon, it's to mark the end of the statement on which the macro is, not to mark the end of the inner expression. Hence :

```
#- Yep -#
ifTrueThenStatementElse0(false) 2;

#- Not really... but it works, reading it as "ifTrueThenStatementElse0(false) 2", then a empty statement -#
ifTrueThenStatementElse0(false) 2; ;

#- No, and it doesn't work -#
ifTrueThenStatementElse0(false) 2; + 3;

#- This is the right way to do it (and it yields 3) -#
(ifTrueThenStatementElse0(false) 2) + 3;

#- Beware, it parses as much as it can, so both of these are the same and yield 0 -#
ifTrueThenStatementElse0(false) 2 + 3;
ifTrueThenStatementElse0(false) (2 + 3);
```

> This allows to visually epurate the code we write, but it doesn't change anything about the way Micro interprets it.

## Macro binding

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

The pattern is always the same : create a complex object (function or class), then assign it to a name (f and A, respectively). While we can't obtain the exact same syntax in Micro, we can mimic it pretty well by using _macro binding_. Suppose you write the following :

```
fun' f(x) {
    #- Some code here -#
}
```

Obviously, you mean to create a function with name `f` and a sole argument, `x`. Well, good news : the parser understands exactly that. The `'` is spelled "bind tick", and the above will be translated to :

```fun'(`f`, x) { #- Some code here -# }```

That is, a call to a standard `fun'` (read "fun-bind") macro, with a literal representing the bound name as their first argument. Macros with a trailing bind tick are known as binding macros, but, aside from that, are totally standard macros.

> Standard up to a certain point, as you can't call a binding macro without... well, binding it to something. As such, `fun'(x) { }` isn't legal syntax.

Note that this `fun'` and an hypothetical `fun` macro are totally disjoint macros, so that adding that bind tick is actively modifying the behavior of your code. Often, it's the desired behavior : you don't want macros such as `if` being bound (`if' x(true) { }` doesn't make sense in the slightest), and sometimes, you might want some macros to always be bound (think of `class` in java, for example). Besides, `fun` and `fun'` could act totally differently : in JS, `function() { }` is an anonymous function object (as such `let f = function() {}` is valid), while `function f() { }` is a statement (as such, `let f = function f() { }` is not).

> This is, once again, pure syntactic sugar, but it's actually a neat feature. For example, `class ("A", B) { ... }` really feels off, while `class' A(B) { ... }` is clear and works like a charm.

## Heart, lungs, liver, nerves

We earlier wrote an `if` macro that worked pretty well : 

```
if (condition) {
    #- code here -#
}
```

While it's all nice and stuff, it lacks something : an else branch. Sure, we could do something like this :

```
if (expr) {
    #- code here -#
}

if (!expr) {
    #- code here -#
}
```

But that's really awkward : what if `expr` is super long and we don't want to write it out twice ? Plus it requires to implement `!` beforehand. Fortunately for us, there is support for something called limbs :

```
if (expr) #- That's the head -# {
    #- Here's the body -#
} else { 
    #- And here's an 'else' limb ! -#
    #- Some code here -#
}
```

Limbs are additionnal blocks of code following a macro and begining with an identifier (here, "else"). It gets stuffed in the macro `AST` along with its `head` and `body` under the `limbs` field. If we were to write an `if` macro with an `else` limb : 

```js
// The declaration is slightly different from our previous if
// Here `limbs` is used to tell that `if` accepts an else { ... } block as a limb
{ name: "if", arity: 1, limbs: ["else"] }

ifReducer = ({$}, { body, head: [condition], limbs: { "else": elseLimb } }) => {
    if ($(condition)) {
        for (let expr of body) {
            $(expr)
        }
    } else {
        for (let expr of elseLimb) {
            $(expr)
        }
    }
}
```

> It is common to refer to macros with limbs by joining together their name and limbs, separed by slashes : `if/else`, for example, would refer to the above macro. It doesn't reflect in the declarations and code however, as the macro is still known as just `if` to the compiler.

Our `if/else` now evaluates its condition, and executes the according block of code : the main one if it's true, the else one if it's false.

A single macro can declare as many limbs as it wants. If `limbs: ...` is not explicitely set inside the macro declaration, it defaults to `[]`. Limbs are pretty flexible and can be used without much restrictions. For example, with a declaration for a macro `try/catch/finally` of `{ name: "try", arity: 0, limbs: ["catch", "finally"]}`, these are all correct :

```
#- All two limbs in the right order -#
try {} catch {} finally {};

#- Missing "catch" limb -#
try {} finally {};

#- No limb at all -#
try {}; 

#- These by the way demonstrate that limbs can be used to mimic really well control flow structures syntax. -#
```

However, this will cause the compiler to crash :

```
#- Error : limbs are not in the right order. -#
try {} finally {} catch {}
```

If a limb is missing, its corresponding field in the `limbs` argument to the macro reducer is defaulted to `[]`, so these two are **exactly** the same :

```
if { #- Blah blah -# }; 
if { #- Blah blah -# } else {}; 
```

> You thus can't check whether or not a limb is actually present. This is a choice that, although not perfect, was made mostly to avoid tedious `undefined` checks. 

Don't overestimate limbs : a thing such as python's `elif` cannot be implemented with them (nor implemented at all) in Micro :

```
#- Not valid Micro syntax -#

if (cond) {

} elif (cond2) {

} elif (cond3) {

} else {

}
```

First because limbs don't take arguments, so `elif (cond2) { ... }` would make the compiler crash, then because limbs can only appear once, so the second `elif` limb would trigger an error. That doesn't mean limbs aren't powerful ; rather that they're not powerful enough to mimic everything and anything. Just like with the macro's body, if the limb consists of exactly one statement, brackets are optional.

> On that elif structure, though : since you can drop brackets whenever the body of a macro, or one of its limbs, is a single statement, that would work :

```
if (cond) {

} else if (cond2) {

} else if (cond3) {

} else {

}
```

> and that's actually how it's implemented in `js` !

## Silence, please

You may have already wondered what curly brackets do when used alone : 

```
#- What is that ? -#
{}
```

The answer is : it's in fact a (although very inconspicuous) macro call to a special macro, called the _silent macro_. It's a stylish name for a macro that is actually called `""` (empty string). So a pair of curly bracket, eventually with statements inside, just calls the silent macro with said statements as its body, no arguments and no limbs. There is no way to pass in arguments or limbs to the silent macro, nor to bind it to anything, and its declaration must therefore always read so : 

```js
{ name: "", arity: 0 }
```

It can be used, for example, to implement JSON-like syntax : 

```
x = {
    a: "foo";
    b: "bar";
    c: {
        hello: "World !";
        list: [1; 2; 3]
    }
}
```
