# Houston, we may have a problem

While this is very fun, there is actually one even funnier thing people might want to do, and that thing is messing around with our code. Because, although this wouldn't come to mind to a reasonnable person, we all know programmers don't belong to that category, and a user might be tempted to do that :

```
fun' add(+1, *2) x+y;  ## Pure fun 
```

It doesn't make sense, yes, but it's legal, and accepted by the compiler. And while here, it's obviously wrong, it could be more insidious, for instance our user wholeheartedly believing that parameter names must be string literals and not `#name`s ; which is a pain, because that's errors we *could* catch early on, since no matter how the program execution goes it will always crash (just like a 'real' syntax error), but since it's standard Micro syntax, it is accepted when parsed. 

## AST preprocessing

That's where AST preprocessing kicks in. What is that, you may ask ? It's going through the `AST` before actually running the script, eventually modifying bits and pieces in the process. It mainly serves two purposes :

* Because it goes through the whole `AST` without evaluating anything, it can catch the mistakes we've seen above, ensuring the script is correct before even trying to execute it.

* It can compress the `AST` by removing syntax-induced overhead. For example, for a function declaration, it could replace every parameter name by its underlying literal, avoiding to go fetch it over and over again at runtime.

Now, you may wonder : how is this implemented ? Does it mean you'll have to learn a whole new bunch of concepts again ? Actually, you already know it all. Micro is basically already all about browsing the `AST` to generate an object of some type `T` ; replace `T` with `AST`, you get a preprocessor. This is exactly how it goes : in the compiler configuration, you might add an additionnal `preprocessors` attribute, which is a list of `MacroReducer<AST>`, that are ran in that order before passing the `AST` to the evaluator. Each preprocessor returns a newer, updated `AST`. In a preprocessor, you might do anything you want, just like when you actually evaluate the `AST`, except, like I've said, you instead return a new `AST` to replace the old one.

> This may look like too much : wasn't Micro supposed to be a lightweight way to implement languages ? It was, and still is. Remember that these are advanced features, that we use now because we precisely want to add advanced features to our language ! Most of the time, you won't need a preprocessor, but it's better to know this possibility exist and allows for more safeness. Plus, as we'll see, it's not that complex to write.

Here's what it looks like :

```js
class DemoMicroPreprocessor extends MicroTransformer {
    lift = l => { /* code here */ }
    reducer = ({$}, { body }) => {
        /* code here */
    }
}
```

Let's think a bit about it. First, what should our lift function return ? Normally, it is supposed to evaluate the literal, but here it is intended to preprocess the literal. Hence, we just want to return an `AST` representing that literal, unchanged. For that, there's the built-in `literal` function, that takes the literal value, an `Metadata` object, and returns a `LiteralAST` : 

```js
class DemoMicroPreprocessor extends MicroTransformer {
    lift = l => literal(l, hmmmmmm)
    reducer = ({$}, { body }) => {
        /* code here */
    }
}
```

Problem : we don't have an `Metadata` at our disposal. Or do we ?

The lift function actually provides it, it's just that we don't use it very often :

```js
class DemoMicroPreprocessor extends MicroTransformer {
    lift = (l, metadata) => literal(l, metadata)  // `lift = literal` would work just fine
    reducer = ({$}, { body }) => {
        /* code here */
    }
}
```

Ok now, let's write our reducer. Simple enough :

```js
class DemoMicroPreprocessor extends MicroTransformer {
    lift = literal

    reducer = ({$}, { body, name, metadata }) => {
        // Remember the script is actually really just a big macro !
        return macro(
            name,
            body.map(stmt => $(stmt)),  // We preprocess every statement
            [],  // No head
            {},  // No limbs,
            metadata,
        )
    }
}
```

And now's for the fun part : we have to write a preprocessor for each macro and operator we use, even if we don't actually do anything. Painful, but inherent to how Micro works. 

Just kidding ! You can provide a `defaultOpReducer` and a `defaultMacroReducer`, so you then just need to implement only the needed preprocessors. Let's do that.


```js
class DemoMicroPreprocessor extends MicroTransformer {
    // Same as for literal : we just create a new OpAST
    // The parameters are the same, in the same order, so we can write this instead of
    // defaultOpReducer = (bla, bla, bla) => operator(bla, bla, bla)
    // In case you wonder, said parameters are `operands`, `operator`, and `metadata`
    defaultOpReducer = operator

    // There we go
    defaultMacroReducer = ({$}, { body, head, name, limbs, metadata }) => {
        let newBody = body.map(stmt => $(stmt))
        let newHead = head.map(stmt => $(stmt))
        let newLimbs = {}; for (let limb in limbs) { newLimbs[limb] = limbs[limb].map(stmt => $(stmt)) }
        return macro(name, newBody, newHead, newLimbs, metadata)
    }

    lift = literal

    reducer = ({$}, { body, name, metadata }) => { /* ... */ }
}
```

Done !

> Wait, why don't we preprocess the operands when reducing an operation ?

Because operations always get handed already `$`-ed values, and in our case `$`-ed values mean preprocessed `AST`s. Ok, almost there, we just have to write our `fun'` preprocessor.

```js

class DemoMicroPreprocessor extends MicroTransformer {
    /* ... */
    
    private funBindPreprocessor = ({$}, { body: bodyAsts, head: [nameAst, ...paramsAsts] }, name, metadata) => {
        // As I've said before, preprocessor can be used to optimize the `AST`.
        // We therefore unpack the literals that are embedded in #name operators to avoid overhead.
        // This also checks on the fly that the parameters are #name operators, 
        // ensuring syntax correctness.
        let newParamsAsts = paramsAsts.map(getLiteralOfName)

        // We process the body because if there's nested function declarations we want to also rewrite them.
        let newBodyAsts = bodyAsts.map(stmt => $(stmt))

        // We return a new macroAST with the modified components.
        // fun'(`f`; x; y) { body } is now fun'(`f`; `x`; `y`) { processedBody }
        return macro(name, bodyAst, [nameAst, ...argsLiteralAsts], {}, metadata)
    }

    reducer = ({$}, { body, name, metadata }) => {
        let opPreprocessors = {}
        // Don't forget to add that
        let macroPreprocessors = { "fun'": this.funBindPreprocessor }

        return macro(
            name, 
            body.map(stmt => $(stmt, opPreprocessors, macroPreprocessors)),
            [],
            {},
            metadata
        )
    }
}

// Don't forget either to add our preprocessor to the compiler !
class DemoMicroCompiler extends MicroCompiler {
    parser = new DemoMicroParser
    preprocessors = [new DemoMicroPreprocessor]  // Gentle reminder that you can have several preprocessors.
    evaluator = new DemoMicroRunner
}
```

And that's done. Conceptually, you might see it like this : first, the compiler will parse the script, generating a draft of our `AST`, in some sense. Then, the preprocessor(s) will review that draft and modify it if needed, resulting in a ready-to-use `AST` ; finally, the evaluator evaluates said `AST`, without worrying about possible syntax errors since they've already been corrected.

> "I keep on thinking that this is a lot of code..."

I thought like you, and explored multiple possible answers to those deviant syntax issues ; I never found a better one than this. Besides, here's what the preprocessor, without the comments, looks like :

```js

class DemoMicroPreprocessor extends MicroTransformer {
    defaultOpReducer = operator

    defaultMacroReducer = ({$}, { body, head, name, limbs, metadata }) => {
        let newBody = body.map(stmt => $(stmt))
        let newHead = head.map(stmt => $(stmt))
        let newLimbs = {}; for (let limb in limbs) { newLimbs[limb] = limbs[limb].map(stmt => $(stmt)) }
        return macro(name, newBody, newHead, newLimbs, metadata)
    }

    lift = literal

    reducer = ({$}, { body, name, metadata }) => { 
        let opPreprocessors = {}
        let macroPreprocessors = { "fun'": this.funBindPreprocessor }

        return macro(name, body.map(stmt => $(stmt, opPreprocessors, macroPreprocessors)), [], {}, metadata)
    }

    private funBindPreprocessor = ({$}, { body: bodyAsts, head: [nameAst, ...paramsAsts] }, name, metadata) => {
        let newParamsAsts = paramsAsts.map(asIdentifier)
        let newBodyAsts = bodyAsts.map(stmt => $(stmt))
        return macro(name, bodyAst, [nameAst, ...argsLiteralAsts], {}, metadata)
    }
}
```

Which is pretty compact when you look at it, not even mentionning the fact that most of it is made out of code that's written once and for all ; only the `funBindPreprocessor` thing is representative of preprocessors you might then write.

> Also, don't forget that all of this is optionnal : most scripts won't even use it at all.

## Syntactic operators 

Suppose now we want to add the possibility to type the function parameters. A possible syntax, used quite broadly, would be :

```
fun 'add(x: int; y: int) x+y;
```

Let's update our compiler to allow that :

```js
// First we introduce ':' by adding its declaration in the parser
{ name: ":", arity: 2 }

// Then we modify our preprocessor
funBindPreprocessor = ({$}, { body: bodyAsts, head: [nameAst, ...paramsAsts] }, name, metadata) => {
    let newBodyAsts = bodyAsts.map(stmt => $(stmt))
    let newParamsAsts = paramsAsts.map(paramAst => {
        // Those two are built-in
        assertOp(paramAst)
        assertOpKind(":", paramAst)
        let [paramNameAst, paramTypeAst] = paramAst.operands

        return operator(paramAst.metadata, ":", [getLiteralOfName(paramNameAst), getLiteralOfName(paramTypeAst)])

    })

    return newMacro(name, bodyAst, [nameAst, ...argsLiteralAsts], {}, metadata)
}

// We would also have to modify the fun' reducer to now check the values passed in match the type,
// but that's beyond the point here
```

Here `:` is some sort of syntactical operator : it serves only as a separator and is not meant to actually be used anywhere else. Every time it sees `:` in a well-formed statement, the compiler should therefore throw, because it's a syntax error. By "well-formed statement", I mean a "regular" statement ; function declaration headers don't belong to that category, and that's why in the preprocessor we don't check them with `$`. To enforce that, we can simply add another preprocessor, this time on operator `:` :

```js
colonPreprocessor = () => { throw "':' is illegal here and should only be used in function headers." }
```

Then pass it to the script preprocessor along with `funBindPreprocessor` :

```js
class DemoMicroPreprocessor extends MicroTransformer {
    reducer = ({$}, { body, name, metadata }) => {
        let macroPreprocessors = { "fun'": funBindPreprocessor }
        let opPreprocessors = { ":": colonPreprocessor }
        
        return newMacro(name, body.map(stmt => $(stmt, macroPreprocessors, opPreprocessors)), [], {}, metadata)
    }
}
```

And that's all : the validity of the syntax of your script is strictly enforced and checked at compile-time, so to say.

> The `MicroCompiler` class has a `MicroCompiler.preprocess(src: string): MacroAST` method, that lets you preprocess a script without running it. You can then run it with `MicroCompiler.eval(ast)` (or directly using the evaluator, via `MicroTransformer.transform(ast)`, although the intent is less clear).

