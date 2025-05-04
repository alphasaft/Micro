
# MICRO SYNTAX REFERENCE  

"What is that syntax reference supposed to be ? Am I about to learn a new language ?", might be respectively the first and second question that come to your mind, and I'm here to answer them both - but not in the right order. Are you about to learn a new language ? Well, yes and no. In a sense, you're about to learn plenty of new languages at once. Micro is a set of syntactic rules, that scripts written using it must follow them ; until there, it's just a normal language. The catch is that these syntactic rules are... well, let's say they're very generic. The Micro library allows you to refine them to obtain a concrete syntax (how exactly is detailed in the `./handbook.md`), and, once it's done - and only then - will you get a language in the most common acceptance of that term. Which brings us to what that syntax reference is supposed to be. It just describes those generic syntax, staying vague enough to allow for high customization, yet narrow enough to ensure that a script can be unambiguously parsed without much help from you. 

## A gentle example

Let's illustrate a little bit the abstract, unclear mess I served you above. Suppose we want to write a calculator DSL, i.e a simple language that is able to perform mathematical operations. Then, here's a syntax we could choose :

* `+`, `-`, `*`, and `/` will be used to add, substract, etc,
* `<` and its associates will be used for comparisons,
* `def` will be used to declare mathematical functions,
* We'll support `return`-ing from those functions, and toss in some control flow.

Here's an example of a script :

```
def fact(n) {
    if (n > 0) return n*fact(n-1)
    else return 1
};

fact(fact(4));  ## Quite a lot, actually !
```

When you'll proceed to the next sections, you'll understand how exactly the script is built, but, for now, let's just try to understand how it works intuitively. When designing our language with the Micro framework, we'll have to specify that we want to bring the possibility to use `+`, `-`, ..., as well as language structures named `def`, `if` and `return` in our scripts. And... that's done ! Of course, we'll have to specify the actual behavior of these features later, but telling their names to the framework is already enough for Micro to know to read your scripts, because it has an already implemented notion of how structures and operators look like : for instance, it knows that if a structure is a declaration of some kind, then the syntax looks like `declarationType nameOfTheThing(args) { statements }` ; this allows to design languages frighteningly quickly, without giving up on expressiveness. 

Let's now delve into what syntactical features at are your disposal when designing a language.


## Basic syntax


A Micro script is a sequence of expressions, separated by semicolons. The last semicolon of a script is optional (and, generally speaking, the last semicolon of everything is). Line breaks and spaces are irrelevant. Expressions are made out of operators, binding together operands : 

```
## This is a valid script
3-2;
"hello" + " world " + "!";
a || b@c;                  
```

As you have noticed, comments start with `##` and end at the line break. They can also be multiline comments wrapped inside a `#- -#` pair.
```
## This is a comment
#- 
And 
so 
is 
this
-#
```


The smallest building blocks for creating expressions are the primitives. The available primitives are strings, numbers and names. Backquotes allow to create names that contain spaces and special characters (in fact, anywhere a series of letters of some sort is expected, you can provided a backquoted expression instead).
```
"MICRO"; "micro";       ## Strings
0;  3.2;                ## Numbers
foo; bar;               ## Names
`he he he !`;           ## Still a name
```


In addition to those primitives, Micro includes somethig known as literals. A literal is formed by prefixing a name with `'` :
```
'lit;                   ## OK
'`backquotes r cool`;   ## OK
```



There's two kind of operators, that differ only by their syntax : symbolic operators (any combination of these symbols : `&|~^@=+-*%/:.,?!<>`), and hash operators. These start with a `#` (hence the name), followed by one or more letters. For instance, this is the hash operator `#in` applied to `0` and `list` :
```
0 #in list;
```

You can use hash operators just like normal operators, everywhere they appear :
```
condition = 0 #in list && 1 #notin list;
```


## Precedence and arity

To know how an expression must be parsed, Micro relies on precedence ; this is a fancy word to say 'some operators go before others'. If `*` has higher precedence than `+` :
```
1+2*3 <=> 1+(2*3);
1*2+3 <=> (1*2)+3;
```

If `#add` and `#sub` have the same precedence, the leftmost one always wins :
```
1 #add 2 #sub 3 <=> (1 #add 2) #sub 3;
1 #sub 2 #add 3 <=> (1 #sub 2) #add 3;
```


Micro packs together operands to a same operator, so `1+2+3` is neither `(1+2)+3`, nor `1+(2+3)`, but the operator `+` applied to `1`, `2` and `3` simultaneously, effectively turning + into a ternary (3-operands) operator here. The explicit pack syntax is handy syntactic sugar meaning the exact same thing :
```
[#op a;b;c;...;z] <=> a #op b #op c #op ... #op z
```


Micro allows unary operators in a prefix form, as well as nullary operators (zero operands) :
```
#print 0;   ## OK
?;          ## OK
```       

If there's an ambiguity, enclose the problematic operator in square brackets or in parentheses :
```
? || 3 <=> (? (|| 3));  ## Probably not what was intended
[?] || 3                ## OK
(?) || 3                ## OK
```


Micro also enforces operator arity, which is yet another complicated word to mean 'how much operands an operator accepts'. So if + is declared with an arity of 2 :
```
1+2;    ## OK
1+2+3;  ## NO
+1;     ## NO
+;      ## NO
```

## Implicit operators         

Some operators are implicitely generated when encountering certain syntactical structures, starting with the `#list` one.
```
[a;b;c] <=> [#list a;b;c];
[a] <=> [#list a];
[] <=> [#list];
```

Similarly, we also have `#tuple` :
```
(a;b;c) <=> [#tuple a;b;c];
(a;) <=> [#tuple a];    ## Warning, without the ';', it's understood as a simple parenthesized expression !
() <=> [#tuple];
```

Next up are `#call`...
```
f(x;y;z) <=> [#call f;x;y;z];
f(x) <=> [#call f;x];
f() <=> [#call f];
```

...and `#index`.
```
array[0;10] <=> [#index array;0;10];
array[0] <=> [#index array;0] <=> array #index 0;
array[] <=> [#index array];
```

Note that the thing that's called/indexed can be anything :
```
(obj.method)(x) <=> [#call object.method;x];
("hello, " + "world !")[0] <=> [#index "hello, "+"world !";0];
```

The precedence of #call and #index respectively are used to determine what is called/indexed. For instance, if + has lower precedence than #index, then :
```
a+b[0] <=> a+(b[0])
```

But if . has higher precedence than #call, then :
```
a.b() <=> (a.b)()
```


In fact, primitives also are implicit operators, called respectively `#number`, `#name` and `#string` :
```
0       <=> [#number '`0`];
x       <=> [#name 'x];
"hi !"  <=> [#string '`hi !`];
```

The `#string` operator differs a bit from the two others in the fact it has additionnal semantics. Should string formatting be used, it will get additionnal arguments :

```
"Hi, {name} !"  <=>  [#string '`Hi, `; name; '` !`]
```

Due to how it is implemented, a call to `#string` that emanated from a string formatting template always begins and ends with a literal, even if said literals must be empty to comply with that rule :

```
"{name}"  <=>  [#string '``; name; '``];
```

In the end, it all boils down to literals, which can be seen as the fundamental building block of Micro scripts. And speaking of blocks : 


## Macros

Until there, we've only seem pretty standard - and simple - expressions. But there's more to Micro than just numbers, strings and names, as Micro comes with something called macros. Macros are yet another kind of operand (meaning everywhere you could put a number, a string or a name, you can use a macro instead), which come in three flavors, the first of which are block macros. A block macro is, as its name suggest, a block of code, wrapped inside a pair of brackets.  The syntax is the following :
```
macroName(arg1; ...; argn) {
    stmt1;
    ...;
    stmtn;
};
```
where `stmti` and `argi` has to be valid expressions. The argument list is often called the head, while the statement list is called the body. Since line breaks and spaces are irrelevant, this is fine as well :
```
macro(
    arg1; 
    ...; 
    argn;
) { stmt1; ...; stmtn };
```

Since macros are regular expressions, you can nest them, operate on them, etc :
```
if (false) {            ##
    if (true) {         ##
        doSomething()   ## OK
    }                   ##
};                      ##    

3 + compute() { ... };  ## OK
```


Additionnaly, a macro can be followed by one or more limbs. These are additionnal blocks of code preceded by an identifier :
```
if (true) {
    doSomething();      ## The standard macro body
} else {
    doSomethingElse();  ## An 'else' limb
};
```

Limbs must always be in the right order, but some can be omitted. For instance, if the macro is declared as try with limbs catch and finally :
```
try { };                        ## OK
try { } finally { };            ## OK
try { } catch { } finally { };  ## OK
try { } finally { } catch { };  ## NO
```


Block macro syntax supports some syntactic sugar. If the head of a block macro is empty, then the parentheses are optional :
```
loop { doThis() }
```

If its body is made of one single statement, you can drop the brackets :
```
loop() doThis() <=> loop() { doThis() };
```

Both rules do hold at the same time :
```
loop doThis();  ## OK
```

However, it is not legal to drop the `{}` if the body is empty.
```
loop {};        ## OK
loop (true);    ## NO 
loop;           ## NO
```


Same goes for the limbs :
```
if (true) { ... } else #throw "ERROR !";    ## OK
if (true) { ... } else {};                  ## OK
if (true) { ... } else;                     ## NO
```

Using a pair of curly brackets alone is understood as invoking a macro named `''` (empty string), which we call the silent macro.
```
{};
```

Just like a normal block macro, statements can be put inside. These will form the body of the macro :
```
{ x;y;z };
```

Should you want to pass arguments and add limbs to the silent macro, you would write this :

```
``(arg1; ...; argn) { x;y;z } limb { };
```

But this is highly unclear, and it is made possible only because of how ``` ` ```-surrounded names work. Here, we literaly invoke the macro which has name ``` `` ``` (empty string), which is simply the silent macro. It is highly recommended not to use this syntax at all.


## Other macro forms

There exist two more macro forms, which are also useful in a variety of situation.

The first of these are inline macros, so called because they almost always are one-liners, are much shorter than their block counterparts. They don't have a body, only a head.
```
return (0)                      ## OK
return (true; false);           ## OK
return (0) { ... };             ## NO, an inline macro can't have a body
return (0) {};                  ## NO, for the same reason
return { "hi"; "hello" };       ## OK, but actually calls the silent macro.
```

They can have limbs, but each limb must be a single expression.
```
import (a) from "file";                  
import (d) from { "file1"; "file2" };    ## Same as above : it's a call to the silent macro
```

The parentheses can be dropped if the head :
- is empty and no limb is following : `return () <=> return;`
- contains exactly one expression, whether or not a limb is following : `import x from "file" <=> import (x) from "file";`

Aside from that, they can't, because it will be ill-parsed.
```
break at externalLoop;  <=>  break (at externalLoop);   ## NO
break () at externalLoop;                               ## OK
import x;y from "file" <=> (import x); (y from file);   ## NO
import (x;y) from "file";                               ## OK
```


The last kind of macros is mostly used to mimic declarations of objects of some kind. They are called declarative macros and have a syntax that differs by quite a bit from the other two. Take for instance a declarative macro called `func`. Then :

```
func f(arg1, ..., argn) returning int { 
    stmts
}
```

would be written, if `func` was a block macro, as :

```
func ('f, arg1, ..., argn) {
    stmts 
} returning int
```

i.e the thing (which has to be an identifier) that immediately follows the macro name is pushed at the front of the head as a `'literal`, and the limbs are located prior to the body. Also, said limbs, just like with inline macros, have to be a single expression ; should brackets be present, they will be understood as a call to the silent macro. The `()` can be dropped if the argument list is empty, but the `{}` around the body are mandatory.

```
## OK
class A extends B {
    ...
};

## NO
class A extends B;

## Technically almost OK, but NO
class A extends B 
    constructor() {  };
```

The last example will indeed be parsed as :

```
       constructor limb ----     --- class body
                           |     |
class A extends B constructor () {};
|        |                    | 
-- name  |                    ---- [#tuple]
         --- extends limb  
```

And hence will crash, because your `class` macro likely didn't expect to have a `constructor` limb, and, even if it did, `[#tuple]` probably has nothing to do there.
