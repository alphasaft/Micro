
# MICRO SYNTAX REFERENCE  


If you read the beginner's handbook first, that's great, else I strongly advise you to do so. In this syntax reference we are going to explore the different syntactic possibilities that are at your disposal when designing a new language with Micro.

## Basic syntax


At its core, any Micro script consists of a sequence of expressions, separated by semicolons. The last semicolon of a script is optional (and, generally speaking, the last semicolon of everything is). Line breaks and spaces are irrelevant. Expressions are made out of operators, binding together literals ; said literals are strings of the form `'lit` or ``` '`a longer literal` ``` (a single quotation mark followed by any sequence of caracters enclosed in backquotes) :

```
## This is a valid script
'x-'y;
'`hello` + '` world ` + '`!`;
'a || 'b@'c;                  
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



There's two kind of operators, that differ only by their syntax : symbolic operators (any combination of these symbols : `&|~^@=+-*%/:.,?!<>`), and hash operators. These start with a `#` (hence the name), followed by one or more letters. For instance, this is the hash operator `#in` applied to the literals `'x` and `'list` :
```
'x #in 'list;
```

You can use hash operators just like normal operators, everywhere the latter appear :
```
'condition = 'x #in 'list && 'y #notin 'list;
```

Micro allows unary operators in a prefix form, as well as nullary operators (zero operands) :
```
#print 'hi;   ## OK
?;          ## OK
```       

If there's an ambiguity, enclose the problematic operator in square brackets or in parentheses :
```
? || 'x <=> (? (|| 3));  ## Probably not what was intended
[?] || 'x                ## OK
(?) || 'x                ## OK
```


Micro "packs" together operands to a same operator, so `1+2+3` is neither `(1+2)+3`, nor `1+(2+3)`, but the operator `+` applied to `1`, `2` and `3` simultaneously, effectively turning + into a ternary (3-operands) operator here. The explicit pack syntax allows to rewrite it in a more compact form if needed.
```
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
```
1+2*3 <=> 1+(2*3);
1*2+3 <=> (1*2)+3;
```

If `#add` and `#sub` have the same precedence, the leftmost one always wins :
```
1 #add 2 #sub 3 <=> (1 #add 2) #sub 3;
1 #sub 2 #add 3 <=> (1 #sub 2) #add 3;
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

Note that the thing that's called/indexed can be any valid expression :
```
(obj.method)(x) <=> [#call object.method;x];
("hello, " + "world !")[0] <=> [#index "hello, "+"world !";0];
```

The precedence of `#call` and `#index` respectively are used to determine what is called/indexed. For instance, if + has lower precedence than `#index`, then :
```
a+b[0] <=> a+(b[0])
```

But if `.` has higher precedence than `#call`, then :
```
a.b() <=> (a.b)()
```

Like we've seen, primitives also are implicit operators. `#string` differs a bit from the two others in the fact it got additionnal semantics. Should string formatting be used, it will get additionnal arguments :

```
"Hi, {name} !"  <=>  [#string '`Hi, `; name; '` !`]
```

Due to how it is implemented, a call to `#string` that emanated from a string formatting template always begins and ends with a literal, even if said literals must be empty to comply with that rule :

```
"{expr}"  <=>  [#string '``; expr; '``];
```


## Macros

Until there, we've only seem pretty standard - and simple - expressions, built out of literals and operators. But there's more to Micro than just numbers, strings and names, as it comes with something called macros. Macros are yet another kind of operand (meaning everywhere you could put a number, a string or a name, you can use a macro instead), which come in three flavors, the first of which are block macros. A block macro is, as its name suggest, a block of code, wrapped inside a pair of brackets.  The syntax is the following :
```
macroName(arg1; ...; argn) {
    stmt1;
    ...;
    stmtn;
};
```
where `stmti` and `argi` have to be valid expressions. The argument list is often called the head, while the statement list is called the body. Since line breaks and spaces are irrelevant, this is fine as well :
```
macro(
    arg1; 
    ...; 
    argn;
) { stmt1; ...; stmtn };
```


Since macros are themselves expressions, you can nest them, operate on them, etc :
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
loop() doThis() <=> loop() { doThis(); };
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


## Other macro forms

There exist two more macro forms, which are also useful in a variety of situations.


### Inline macros

The first of these are inline macros, so called because they almost always are one-liners, much shorter than their block counterparts. They don't have a body, only a head.
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

### Declarative macros

The second kind is mostly used to mimic declarations of objects of some kind. They are called declarative macros and have a syntax that differs by quite a bit from the other two. Take for instance a declarative macro called `func`. Then :

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

## Technically OK, but NO
class A extends B 
    constructor() {  };
```

The last example will indeed be parsed as :

```
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