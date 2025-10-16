
# MICRO SYNTAX REFERENCE  


Before reading this, you should probably check out the [beginner's guide](Beginner%20Handbook.md) first. If you already did, let's get started ! In this syntax reference we are going to explore the different syntactic features that are at your disposal when designing a new language with Micro. If you need a summary of all that's said here, check the cheat sheet.

## Basic syntax


At its core, any Micro script consists of a sequence of expressions, separated by semicolons. The last semicolon of a script is optional (and, generally speaking, the last semicolon of everything is). Line breaks and spaces are irrelevant. Expressions are made out of operators, binding together literals ; said literals are strings of the form `'lit` or ``` '`a longer literal` ``` (a single quotation mark followed by any sequence of caracters enclosed in backquotes). Operators (and macros, which we'll see later) are Micro's core : when we say "defining your syntax", we mean "choosing which operator can and cannot appear, with which arity, and which precedence". Micro then handles the rest for you. This, for instance, would be a valid script, should we have chosen to include operators `+`, `-`, `||` and `@` as a part of our language :

```mc
## Works !
'x-'y;
'`hello` + '` world ` + '`!`;
'a || 'b@'c;                  
```

As you have noticed, comments start with `##` and end at the line break. They can also be multiline comments wrapped inside a `#' '#` pair.
```mc
## This is a comment
#' 
And 
so 
is 
this
'#
```


There's two kind of operators, that differ only by their syntax : symbolic operators (any combination of these symbols : `&|~^@=+-*%/:.,?!<>`), and hash operators. These start with a `#` (hence the name), followed by one or more alphanumeric characters. For instance, this is the hash operator `#in` applied to the literals `'x` and `'list` :
```mc
'x #in 'list;
```

You can use hash operators just like normal operators, everywhere the latter appear :
```mc
'condition = 'x #in 'list && 'y #notin 'list;
```

Micro allows unary operators in a prefix form, as well as nullary operators (zero operands) :
```mc
#print 'hi;   ## OK
?;          ## OK
```       

If there's an ambiguity, enclose the problematic operator in square brackets or in parentheses :
```mc
? || 'x <=> (? (|| 3));  ## Probably not what was intended
[?] || 'x                ## OK
(?) || 'x                ## OK
```


Micro "packs" together operands to a same operator, so `'a + 'b + 'c` is neither `('a+'b)+'c`, nor `'a+('b+'c)`, but the operator `+` applied to `'a`, `'b` and `'c` simultaneously, effectively turning `+` into a ternary (3-operands) operator here. The explicit pack syntax allows to rewrite it in a more compact form if needed.
```mc
[#op a;b;c;...;z] <=> a #op b #op c #op ... #op z
```
The difference between both forms is purely syntactic.


## Primitives

Since the `'lit` syntax can be quite clumsy, Micro provides syntactic sugar to ease up the burden, by introducing primitives. Their name is a bit misleading : the true (and only) primitive building block of Micro are literals ; primitives, are, however, some kind a middle ground between the very low-level literals and more complex code structures.

Micro ships three kind of primitives : string, numbers, and names. Using a primitive implicitely generates an specific operation wrapping a literal :
- Strings, like `"hello world"`, are sequences of caracters enclosed in double quotation marks. They are translated to a call to a special hash operator, `#string`, with the string as a literal as its sole argument ; so, here, `"hello world"` is the same as ```[#string '`hello world`]```.
- Numbers (a term that regroups both integers and floats), like `0`, `3.1415` or `.42`, are translated as a call to `#number`, so that `0` is actually ```[#number '`0`]```.
- Names (known as identifiers in other langages, although there's slight differences we'll cover later), like `foo` or `bar`, are translated as a call to `#name`. `meaning_of_life` is hence understood as ```[#name 'meaning_of_life]```. Just like with literals, you can use backquotes if you need names containing special caracters.

With these rules, `x = y+1`, for instance, becomes under the hood ```[#name 'x] = [#name 'y] + [#number '`0`]```. Even if it's not recommended, explicitely using `#string`, `#name` and `#number` in a script is perfectly legal.


## Precedence and arity

To know how an expression must be parsed, Micro relies on precedence ; this is a fancy word to say 'some operators go before others'. If `*` has higher precedence than `+` :
```mc
1+2*3 <=> 1+(2*3);
1*2+3 <=> (1*2)+3;
```

If `#add` and `#sub` have the same precedence, the leftmost one always wins :
```mc
1 #add 2 #sub 3 <=> (1 #add 2) #sub 3;
1 #sub 2 #add 3 <=> (1 #sub 2) #add 3;
```

Micro also enforces operator arity, which is yet another complicated word to mean 'how much operands an operator accepts'. So if + is declared with an arity of 2 :
```mc
1+2;    ## OK
1+2+3;  ## NO
+1;     ## NO
+;      ## NO
```

## Implicit operators         

Some operators are implicitely generated when encountering certain syntactical structures, starting with the `#list` one.
```mc
[a;b;c] <=> [#list a;b;c];
[a] <=> [#list a];
[] <=> [#list];
```

Similarly, we also have `#tuple` :
```mc
(a;b;c) <=> [#tuple a;b;c];
(a;) <=> [#tuple a];    ## Warning, without the ';', it's understood as a simple parenthesized expression !
() <=> [#tuple];
```

Next up are `#call`...
```mc
f(x;y;z) <=> [#call f;x;y;z];
f(x) <=> [#call f;x];
f() <=> [#call f];
```

...and `#index`.
```mc
array[0;10] <=> [#index array;0;10];
array[0] <=> [#index array;0] <=> array #index 0;
array[] <=> [#index array];
```

Note that the thing that's called/indexed can be any valid expression :
```mc
(obj.method)(x) <=> [#call object.method;x];
("hello, " + "world !")[0] <=> [#index "hello, "+"world !";0];
```

The precedence of `#call` and `#index` respectively are used to determine what is called/indexed. For instance, if + has lower precedence than `#index`, then :
```mc
a+b[0] <=> a+(b[0])
```

But if `.` has higher precedence than `#call`, then :
```mc
a.b() <=> (a.b)()
```

Like we've seen, primitives also are implicit operators. There's a bit more than what we saw earlier.

### String formatting

`#string` supports string formatting, as in :

```mc
"Hi, {name} !"  <=>  [#string '`Hi, `; name; '` !`]
```

Due to how it is implemented, a call to `#string` that emanated from a string formatting template always begins and ends with a literal, even if said literals must be empty to comply with that rule :

```mc
"{expr}"  <=>  [#string '``; expr; '``];
```

That means you can rely on that invariant for your `#string` implementation.

If you want to disable string formatting, just set `#string`'s arity to 1.

### Number formats

If your number starts with `0<some letter>`, as `0x` or `0b`, any alphanumeric characters following it are parsed, until a space or a nonalphanumeric character is encountered. Then, a call to `#number` is generated, with its first argument being that sequence of alphanumerics as a literal, and its second argument the letter following the `0` (also as a literal). For example, `0x1f2` is translated as ``[#number, '`1f2`, 'x]``. Be careful : **any** sequence of alphanumerics is accepted, even if it does not appear to match the number format (`0b999`, for instance, would be parsed without triggering any errors). You must hence take care of those edge cases yourself. 

Like with string formatting, set `#number` arity to 1 to disable that feature.

### And `#name` ?

For now, `#name` does not have any special semantics. That may change in the future.


## Macros

Until there, we've only seem pretty standard - and simple - expressions, built out of literals and operators. But there's more to Micro than just numbers, strings and names, as it comes with something called macros. Macros are yet another kind of operand (meaning everywhere you could put a number, a string or a name, you can use a macro instead), which come in three flavors, the first of which are block macros. A block macro is, as its name suggest, a block of code, wrapped inside a pair of brackets.  The syntax is the following :
```mc
macroName(arg1; ...; argn) {
    stmt1;
    ...;
    stmtn;
};
```
where `stmti` and `argi` have to be valid expressions. The argument list is often called the head, while the statement list is called the body. Since line breaks and spaces are irrelevant, this is fine as well :
```mc
macro(
    arg1; 
    ...; 
    argn;
) { stmt1; ...; stmtn };
```


Since macros are themselves expressions, you can nest them, operate on them, etc :
```mc
if (false) {            ##
    if (true) {         ##
        doSomething()   ## OK
    }                   ##
};                      ##    

3 + compute() { ... };  ## OK
```


Additionnaly, a macro can be followed by one or more limbs. These are additionnal blocks of code preceded by an identifier :
```mc
if (true) {
    doSomething();      ## The standard macro body
} else {
    doSomethingElse();  ## An 'else' limb
};
```

Limbs must always be in the right order, but some can be omitted. For instance, if the macro is declared as try with limbs catch and finally :
```mc
try { };                        ## OK
try { } finally { };            ## OK
try { } catch { } finally { };  ## OK
try { } finally { } catch { };  ## NO
```

Block macro syntax supports some syntactic sugar. If the head of a block macro is empty, then the parentheses are optional :
```mc
loop { doThis() }
```

If its body is made of one single statement, you can drop the brackets :
```mc
loop() doThis() <=> loop() { doThis(); };
```

Both rules do hold at the same time :
```mc
loop doThis();  ## OK
```

However, it is not legal to drop the `{}` if the body is empty.
```mc
loop {};        ## OK
loop (true);    ## NO 
loop;           ## NO
```


Same goes for the limbs :
```mc
if (true) { ... } else #throw "ERROR !";    ## OK
if (true) { ... } else {};                  ## OK
if (true) { ... } else;                     ## NO
```


## Other macro forms

There exist two more macro forms, which are also useful in a variety of situations.


### Inline macros

The first of these are inline macros, so called because they almost always are one-liners, much shorter than their block counterparts. They don't have a body, only a head.
```mc
return (0)                      ## OK
return (true; false);           ## OK
return (0) { ... };             ## NO, an inline macro can't have a body
return (0) {};                  ## NO, for the same reason
return { "hi"; "hello" };       ## OK, but actually calls the silent macro.
```

They can have limbs, but each limb must be a single expression.
```mc
import (a) from "file";                  
import (d) from { "file1"; "file2" };    ## Same as above : it's a call to the silent macro
```

The parentheses can be dropped if the head :
- is empty and no limb is following : `return () <=> return;`
- contains exactly one expression, whether or not a limb is following : `import x from "file" <=> import (x) from "file";`

Aside from that, they can't, because it will be ill-parsed.
```mc
break at externalLoop;  <=>  break (at externalLoop);   ## NO
break () at externalLoop;                               ## OK
import x;y from "file" <=> (import x); (y from file);   ## NO
import (x;y) from "file";                               ## OK
```

### Declarative macros

The second kind is mostly used to mimic declarations of objects of some kind. They are called declarative macros and have a syntax that differs by quite a bit from the other two. Take for instance a declarative macro called `func`. Then :

```mc
func f(arg1, ..., argn) returning int { 
    stmts
}
```

would be written, if `func` was a block macro, as :

```mc
func ('f, arg1, ..., argn) {
    stmts 
} returning int
```

i.e the thing (which has to be an identifier) that immediately follows the macro name is pushed at the front of the head as a `'literal`, and the limbs are located prior to the body. Also, said limbs, just like with inline macros, have to be a single expression ; should brackets be present, they will be understood as a call to the silent macro. The `()` can be dropped if the argument list is empty, but the `{}` around the body are mandatory.

```mc
## OK
class A extends B {
    ...
};

## NO
class A extends B;

## Technically OK, but NO
class A extends B 
    constructor() {  };
```

The last example will indeed be parsed as :

```mc
     "constructor" limb ----     --- empty body
                           |     |
class A extends B constructor () {};
|        |                    | 
-- macro |                    ---- [#tuple]
         --- "extends" limb  
```

And hence will crash, because your `class` macro likely didn't expect to have a `constructor` limb, and, even if it did, `[#tuple]` probably has nothing to do there.

### The silent macro

Finally, using a pair of curly brackets alone is understood as invoking a special macro named `''` (empty string), which we call the silent macro. It is technically a block macro.
```mc
{};
```

Just like a normal block macro, statements can be put inside. These will form the body of the macro :
```mc
{ x;y;z };
```

The block macro can't have a had or limbs.