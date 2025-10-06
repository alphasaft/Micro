# Micro beginner's handbook

Micro is an attempt at finding a middle ground between fully designing a parser and being forced to comply with (sometimes quite rigid) preexisting languages when writing DSLs. The library is the conjuction of a (proto-)language and of the tools needed to interpret it. It works as follow :

1. In no more than a few lines, you tell what syntax you'd like to use,
2. Micro generates the appropriate parser,
3. That parser outputs an abstract syntactic tree (AST) when given any valid script
4. The Micro library provides you with the tools to interpret that AST, thereby executing your code

For this handbook file, we'll suppose we want to create a simple mathematical language, featuring arithmetic, printing to the console, and so on.

## `MicroParser`

This class lets you declare the version of the Micro Language you'd like to use. For our language (and to begin with) we'll want to use `+`, `-`, `*`, and `/`, so we just subclass `MicroParser` and tell exactly that within the constructor :

```js
import { MicroParser } from "micro-lang"

class DemoParser extends MicroParser {
    constructor() {
        super({
            operators: [
                [{ name: "#number", arity: 1 }]
                [{ name: '*', arity: 2 }, { name: '/', arity: 2}],
                [{ name: '+', arity: 2 }, { name: '-', arity: 2 }]
            ]
        })
    }
}
```

One thing of note is that the order in which the operators are declared represent their relative precedence. Here, `*` and `/` have same precedence, but higher precedence than `+` and `-`, meaning `1+2*3/4` would be parsed as `1+((2*3)/4)`, as you'd expect. The `arity` field is how many terms each operator takes to work. Also, `#number` is only there to specify we can use number literals within our scripts. As its precedence doesn't really matter (it will not appear explicitely in-script), we put it at the top by convention.

## `MicroReducer`

Now, we may specify the behavior of those operators using Micro's `MicroReducer` class. The `script` field of such a reducer is the entry point :

```js
import { MicroReducer } from "micro-lang"

class DemoReducer extends MicroReducer {
    script = ({use}, { body }) => {
        // ...
    }
}
```

Here, `body` is a list of all of the script's top-level statements, and `use` is a function allowing to specify the implementations (called "reducers") we'll want to use for our operators. Let's fill the gaps :


```js
import { MicroReducer } from "micro-lang"

class DemoReducer extends MicroReducer {
    script = ({use}, { body }) => {
        let $ = use({
            operators: {
                '#number': ($, a) => parseInt($(a))
                '+': ($, a, b) => $(a)+$(b),
                '-': ($, a, b) => $(a)-$(b),
                '*': ($, a, b) => $(a)*$(b),
                '/': ($, a, b) => $(a)/$(b)
            }
        })

        for (let stmt of body) {
            console.log($(stmt))
        }
    }
}
```

With `use`, we tell that what `+` does is `$`-ing (`$` always reads "evaluate" in Micro) its operands, then adding them ; it goes similarly for the others. What `use` returns is a `Evaluator`, `$`, which we can use to evaluate every statement in your body, and print the result.

> **NOTE** : The `$` in `script` is *a priori* not the same as the `$` in the `operators` implementations. This is because evaluating pieces of code does depend on *where* you do so. This behavior is refered to as scoping, and you can find more in the [advanced handbook](Advanced%20Handbook.md)

The last piece of the puzzle is to add a `lift` function. If you want to find more about `lift`, see the [advanced handbook](Advanced%20Handbook.md), as we are not gonna cover it here. Just know it is an advanced feature that can come in handy ; most of the time, however, taking `lift = s => s` is amply enough.

```js
class DemoReducer extends MicroReducer {
    lift = s => s
    script = ...
}
```

## `MicroRunner`

Finally, let's bring this all together.

```js
import { MicroRunner } from "micro-lang"

class DemoRunner extends MicroRunner {
    parser = new DemoParser
    reducer = new DemoReducer
}
```

You can now instantiate a runner with `let runner = new DemoRunner`, and run any script with `runner.run(script)`, where `script` is a string. Normally, running :

```
## This is our first script !
1+3*4-5;
1-7;
3/2*2/3;
```

Should print `8`, `-6` and `1.0`.

> **NOTE** : Some mathematical expressions, such as `-1` or `1+2+3`, will raise an error from Micro. This is normal, and the reason why, as well as the (minor) fix, are detailed in the [advanced handbook](Advanced%20Handbook.md#11-arity).

## An additionnal feature

We now want to add a new structure, called `silent`, which will execute but not print to the terminal any computations within it. Doing so is simple. First, we declare that structure in our parser :

```js
class DemoParser extends MicroParser {
    constructor() {
        super({
            operators: ...,
            macros: [
                { name: "silent", arity: 0, kind: "block" }
            ]
        })
    }
}
```

The arity of the macro is `0`, meaning it takes no arguments (only a block of code). The kind of the macro is `block` ; roughly speaking, this means we expect its syntax to be a block of code enclosed in curly brackets.

> **NOTE** : More about the different macro syntaxes and the way to declare them in the [advanced handbook](Advanced%20Handbook.md#2-macros) and the [syntax reference](Syntax%20Reference.md). We'll take the following definition for now : a macro is a specific block of code preceded by an identifier.

Next, as before, we write a reducer. Macro reducers work the same way as the `script` function : they take a `use` function, a `body` which is a list of statements, and do stuff with them.

```js
class DemoReducer extends MicroReducer {
    lift = s => s

    script = ({use}, { body }) => {
        let $ = use({
            operators: { /* Same as before */ },
            macros: { "silent": this.silentReducer, }
        })

        for (let stmt of body) $(stmt)
    },

    silentReducer = ({use}, { body }) => {
        // We do not want to use any additional reducers 
        // than the ones declared in script
        let $ = use({})
        for (let stmt of body) $(stmt)
        return "<silenced>"
    }
}
```

And done. If you write :

```
3*42;
7-6+5-4+3-2+1-0;
silence {
    1+1;
    2/2;
};
```

and execute it with `runner.run(...)`, if would print `126`, `4`, and `<silenced>`.

Congratulations, you've created a functionnal calculator in less than thirty lines ! If you wish to learn more and delve into Micro's advanced features, feel free to explore the [advanced hanbook](Advanced%20Handbook.md), as well as the full [syntax reference](Syntax%20Reference.md). There's much more in store !


