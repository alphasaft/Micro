# Operators

Now that we know the basics of how a MicroCompiler does its job, we can go back to the Micro language itself, and explore the syntactic possibilities it offers, starting with operators.

> "Why'd you write another chapter entirely focused on operators ? Haven't we covered most of it already ??"

Nope we don't. Actually, we didn't talk a lot about operators until now. We'll cover many useful syntactic features here, which are very important to code in Micro.

We said that `OpDeclaration` takes in an `arity` argument too, remember ? Until there, we exclusively used _binary operators_ (which means "operators with an arity of two"), but these are not the only ones to exist.

> A quick reminder that operators always need to update their arity accordingly to be used in the ways that will follow !

## 2 is good, but 1 is better.

We can use operators in a unary way by prefixing an expression with said operator. Operator precedences still apply, but only at the right of the operator, as unary operators automatically bind tighter than everything on their left side.

So `1 * +1` is parsed as `1*(+1)` since unary operators bind tighter that everything there is on their left, but `+1*1` is parsed as `+(1*1)` since precedence on the right side works normally and `*` binds tighter than `+`. This may seem weird, but it's actually the standard behavior of parsers.

> If this confuses you, don't think too much about it ; it is intended to conform to your intuition.

Notice that the space between `*` and `+` in the first expression is mandatory : `1*+1` would be parsed as the operator `*+` applied to two ones. 

This, combined with low-precedence hash operators, allows for syntax reminiscent of python 2.0, with directives-like expressions such as `#print 1*2`.  

## Associativity and packing

Let's come back to what happens when an expression such as `1+2+3` is encountered. In standard languages, there's mostly three things that can happen :

* Either it is understood as `(1+2)+3`, which is known as left associativity,
* Or, it is parsed as `1+(2+3)`, which is right associativity and is the behavior of operators such as `^` in standard JS,
* Last but not least, it's deemed ambiguous and triggers a parsing error. This is no-associativity. 

Micro does neither of the above. Instead, it opts for a far less common behavior called **packing**, which is to parse `1+2+3` as... `1+2+3`. In other words, it just applies `+` to `1`, `2` AND `3` at the same time, which results in a call to the `+` operator reducer with `[1,2,3]` as its argument. Hence, if your declaration for `+` is `{ name: "+", arity: 2 }`, `1+2+3` will actually trigger an error. 

> Packing is a default behavior that can be avoided with parenthesis, just like when you wish to override priority : `(1+2)+3` applies `+` to `1+2` and `3` rather than to `1`, `2` and `3` at once.

Suppose you want to allow expression like `1+2+3` in your scripts. Then, you need to update `arity: 2` to `arity: twoOrMore` (`twoOrMore` is a built-in exported Micro value, which is just `[2, Infinity]`), and to write the following :

```js
plusReducer = args => args.reduce((a,b) => a+b)
```

`reduce` is a native JS Array method that behaves just like left associativity : `[a,b,c,d].reduce(f)` is `f(f(f(a,b),c),d)`. Here, we get `((a+b)+c)+d`, which is exactly what we want. This pattern is so common that Micro exports a helper function called `lar` (for left-associative reducer) :

```js
plusReducer = lar((a,b) => a+b)
```

> Left associativity can be implemented with `lar`, right-associativity with its `rar` counterpart, and no-associativity by setting the operator's `arity` to 2 (or less).

Now, you may wonder : why choose to pack on operators rather than use, for instance, left-associativity by default ? It does add some boilerplate code, and if the first example of right-associativity that comes to mind is `^`, which is rather uncommon to say the least (and expressions of the form `a^b^c` even more so), then maybe it's not worth bothering ?... 

Long story short, forcing left associativity everywhere would be error-prone, because it would make expressions like `a^b^c` behave like `(a^b)^c = a^(b*c)` without warning the user. Besides, the impossibility to write ternary operators would be quite annoying. Take `<=` for instance. In mathematics, you can write `a <= b <= c`. Making `<=` left-associative (which is the way it's implemented in JS) just doesn't feel right, because it means that `a <= b <= c` is parsed as `(a <= b) <= c`, hence comparing the boolean `a <= b` to `c`, which isn't the desired behavior. We see that right-associativity doesn't make sense either ; so what ? Well, packing allows to capture the meaning of `a <= b <= c` as a single expression, and to accordingly translate it to `a <= b && b <= c` when running it. More generally, if you write a DSL - which can look quite different from standard programming languages depending on your needs -, very often you'll find yourself using non-left associative operators (either in a right-associative or a ternary-and-more fashion).

## Explicit packing 

The packing behavior we've seen until now is called "implicit packing", because it's somewhat done under the hood, and you would probably not notice it if I hadn't told you. Sometimes, you want to make it obvious ; For that, we have at disposition what is called the explicit pack syntax, which takes the following form :

```
[#op arg1; arg2; ...; argn;]  ## The last semicolon is, as ever, optional. #op can be a symbolic or hash operator.
```

This is exactly the same as writing `arg1 #op arg2 #op ... #op argn`, it's just another syntactic possibility. This comes in handy when using implicit packing would be very confusing. For instance, suppose you have some operator `#invoke` that, let's say, invokes a command on the command line. Then :

```
"mkdir" #invoke "myDirectory";   ## Very unclear

"mkdir" #invoke "-d" #invoke "myDirectory";  ## That's even worse

[#invoke "mkdir"; "-d"; "myDirectory"];  ## Neat !
```

## Nullary operators

Have you ever tried applying an operator to nothing ?

```
#pi;  #- With #pi an operator taking no operands and returning 3.1415... -#
```

This will crash, actually, with `Unexpected character ';'` or something similar. This is because it sees `#pi` as an unary operator here, and when it encounters the semicolon, it doesn't understand why there isn't any operand following it.

To call an operator with 0 arguments, you thus need to enclose it in square brackets : `[#pi];` is correct and yields the expected result. 

> While this may seem like somewhat new syntax, this is actually the explicit packing syntax doing its job !

## Special operators 

### Lists and tuples

Should you try to use the pack syntax without any leading operator, something rather cool would happen :

```
#- Take that ! -#
x = [];
y = [1];
z = [1;2];
```

Under the hood, Micro assumes that what you meant was to use the special `#list` operator. So this actually is :

```
x = [#list];
y = [#list 1];
z = [#list 1;2]
```

The same happens if the enclosing characters are plain parentheses : expressions of the form `(x1;...;xn)` are translated to `[#tuple x1;...;xn]`, and `()` is actually `[#tuple]`. Caution : `(x)` is simply `x`, and you have to add a trailing `;` to invoke `#tuple` instead : `(x;)` is `[#tuple x]`.

### Calls and indexing

When an expression of the form `callee(arg1; ...; argn;)` (last semicolon optional) is encountered, `callee` as well as `arg1`, ..., `argn` are parsed, then passed together to the special `#call` operator in that order.

This is very neat syntactic sugar that allows for function call-like expressions !

```
myFunction(1; 2; 3);  #- Same as [#call myFunction; 1; 2; 3] ! -#
```

> That form suggests `callee` must be a name, but it actually can be any expression. "hi"(1) is therefore perfectly valid.

Note that semicolons tell arguments apart from each other, not comas. Comas are regular operators, and `f(1,2,3)` is actually `[#call f; (1,2,3)]`. This might take some time for you to get used to it.

> Using `#call` without that added syntactic sugar is not considered a bad practice, and you can write `[#call f; 1; 2]` instead of `f(1; 2)` if you prefer. Writing `f #call 1 #call 2`, on the other hand, is very unclear and therefore not recommanded.

Same goes for `x[arg1; ...; argn;]` (last semicolon optional) with the `#index` operator : it will be translated to `[#index x; arg1; ...; argn]`, so that you can write `myArray[0]` to mean `myArray #index 0`. Neat, isn't it ?

> Don't forget that `#call` and `#index` arity is one more than what you would expect, because the thing that's called/indexed is itself an argument to it. Declaring `#index` with an arity of 1 would actually only allow expressions of the form `x[]`.

How this syntax is parsed directly depends upon operators precedence, as call/index expressions bind tighter than everything on their right, but precedence applies normally at their left, using precedence of `#call` and `#index` respectively. So if `.` has higher precedence than `#call`, which itself has higher precedence than `+`, `"hi".toUpperCase()` is `("hi".toUpperCase)()`, but `"hi"+myFunction()` is `"hi" + (myFunction())`, just like you would expect.

> If you declare both `#call` and `#index`, it's generally speaking a good idea to declare them with the same precedence. Nothing written in stone, but that would be pretty confusing to have `a.b(c)` behave as `(a.b)(c)` but `a.b[c]` as `a.(b[c])`. 

Such expressions can finally be nested : `x[0][1]` is `(x #index 0) #index 1`, `f()()` is `[#call [#call f]]`, and `x[0]()` is `#call (x #index 0)`. If you wish to call/index complex expressions, wrapping them inside parentheses works just fine : `(my #complex expression)[index]`


## String format using `#string` (BROKEN FOR NOW)

There is slightly more going on with strings than what I told you. In Micro, we have _string formatting_, which takes this form : if a `{` is encountered inside a string, the compiler will try to parse the expression contained between it and the closing `}`. Then, it passes that AST to the `#string` operator, and goes on.

For example, parsing `"1+2 is {1+2} !"`  will result in the following call to `#string` :

```
[#string 
    `1+2 is `; 
    { AST for 1+2 };
    ` !`;
]
```

Due to how string formatting is implemented, arguments to `#string` will always alternate between a literal and a string format argument, starting and ending with a literal, so `"{name} said to me {msg}"` would yield :

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
