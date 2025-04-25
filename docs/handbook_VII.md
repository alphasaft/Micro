
# Macro modes

Inline macros are the most unique syntactic feature of Micro, but, paradoxically, they don't bring anything truly new ; it rather make clever use of already-seen concepts to a new extent. Paired with preprocessors, they allow for myriads of possibilities, and allow Micro to effortlessly mimic most languages that exist down there, even ones that broadly differ, like `python` and `SQL`.
A few paragrahs above, you learned that parentheses and brackets in a macro call are optional if the situation allows it. A natural question is : can we remove both at the same time ? The answer is yes, and the result might remind you of a thing you know very well. Let's say our macro is called `import`, for example : 

```
## This
import() { A };

## Is the same as
import { A }; 

## Which is the same as 
import A;
```

> Be cautious : should `A` be a `#tuple` instead, it would try to pass its content to `import`, because it would see it as arguments to it. To prevent that, don't drop the parentheses : `import() (0;0)`, for example. Note that if there's ever a need to pass a tuple as the one-liner body of an inline macro, maybe it just means that macro should use its head instead.

So, yeah : the result is a keyword. In Micro, it's known as an inline macro. Which... look... an awful lot like an unary operator. Is it actually useful ?

## Enforcing inline macros

Yes, it is. So useful, actually, that it got its own implementation in the compiler. Macro declarations accept an additionnal `mode` flag, which can be one of the following :

* `block` : The default flag value. It doesn't enforce anything about the syntax of the macro.
* `full` : The parser requires brackets around the body and the limbs.
* `inline` : The parser forbids using `{ ... }` around the body and the limbs, which must therefore always be one-liners. 
* `half-inline` : The parser puts no restrictions on the body, but the limbs must be one-liners.

Inline macros correspond to the last two settings, which are to be declared by you along with the macro name, arity and limbs. Now, let's see why we would want to use that instead of a good old `#import` operator.


## Operators are blind

The main problem is that operators don't get to see the `AST`s, because they're instead directly handed values. In chapter V, we implemented the `#name` operator to retrieve values from the scope, mimicking variables, which is the way most languages would use it. Suppose we then want to implement imports, but with a `#import` operator rather than an `import` macro. Then, this :

```
#import A;
```

would probably crash while trying to retrieve the value of the variable `A`. Worse, if `A` were to be bound to something, say, `"hello world !"`, well, your statement would be virtually indistinguishable from `#import "hello world !";`... likely not what was intended. 

> "Wait, I could use preprocessors to replace `#import A;` with ```import A;``` at compile time !"

Yeah, but that has one critical downside : it allows the user to use both, as you'd have to also declare `import`. And when you're faced with both `#import` and `import`, it's not clear which one to use.

> "Okay, then maybe replace it with `#import "A"` ?"

Same. That means that it will be unclear whether `#import` should be provided with a string or a name. Here, it's not blatant, but that can lead to pretty fierce headaches. Another thing, more severe maybe, can also happen : You might choose to increase the arity of `#import` to `oneOrMore`. Which is fine, until you now realize that to import more than one thing, you must use this syntax :

```
[#import A; B];
```

Which is... not that good looking, because avoiding the additionnal brackets would have been nice. The real problem, however, is that you just allowed for this :

```
A #import B;
```

And that is bad, because it is highly confusing : is `A` some kind of import manager ? Is `A #import B` the same as `B #import A` (it is !) ? And finally, last but not least, you risk seeing things like this :

```
A #import B #import C;
```

Yummy. And there's no way to control that weird syntax, not even with preprocessors, since explicit and implicit pack syntax generate the exact same `AST`s. So operators definitely aren't the tools we want to use when dealing with syntactic constructs.

> But the other way around is true too ! Don't try to use macros everywhere, where simple operators could do the trick ; for instance, macros can't be used in an infix fashion (i.e `a #in b`), nor as nullary operators ; in other words, both are very good at specific tasks !

## For the sake of complexity

On the other hand, let's look at how nicely macros handle that kind of thing. To demonstrate, suppose we want a richer, python-like version of `import` that allows us to alias libraries :

```python
import numpy as np
```

That's actually native Micro syntax, brought to you on a silver plate ! The declaration for the macro should simply be `{ name: "import", arity: 0, limbs: ["as"], mode: "inline" }`, and you get precisely what you want, which would be impossible with plain operators. Easy peasy ! An even more idiomatic version of that would be (but that's a matter of preferences) :

```
import 'np numpy
```

Which, I remind you, is a `{ name: "import'", arity: 1, mode: "inline" }` macro, which will be called as ```import'(`np`) { numpy }```. With the `half-inline` mode, you can allow for slightly more flexibility, and have things like :

```
dataimport (json) { data_1 ; data_2 ; data_3 } from myDataBase
```

Another possibility is SQL-like syntax : with a `{ name: "SELECT", arity: 0, limbs: ["IN", "WHERE"], mode: "half-inline" }` macro, you can natively write things like :

```
SELECT { a; b } IN table WHERE b >= 3
```

Which, once again is a level of complexity that could never be reached, or even approximated, with operators. Then, with a few preprocessors, you can enforce syntax correctness, and enjoy beautiful Micro scripts such as :

```
import { MicroCompiler } from "compiler.mc";

class' DemoMicroParser(MicroParser) {
    operators = [[{ name: "#helloworld"; arity: 0 }]];
    macros = [];
};

class' DemoMicroEvaluator(MicroTransformer) {
    lift = fun(l) l;
    reducer = fun (ctx, ast) { 
        let operators = { "#helloworld": fun() { #print "Hello world !!!" } };
        let macros = {};
        for (stmt #of ast.body) ctx["$"](stmt; operators; macros);
    };
};

class' DemoMicroCompiler(MicroCompiler) {
    parser = new DemoMicroParser;
    evaluator = new DemoMicroEvaluator;
};

#- Back to the start ! -#
let myCompiler = new DemoMicroCompiler;
myCompiler.run("[#helloworld];");
```
