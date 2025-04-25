
# Syntax versus semantics

You may have noticed that until now I only talked about what you could _write_ in a script, not about what that would actually do. The first is known as the syntax of the language, the second as the semantics. And that's where Macro stands out : although it **does** have a specified syntax, said syntax has absoltely no semantics attached to it. Which means that the compiler has no idea what to do with your scripts for now ! So if you try to just compile the code we've seen until there, it will crash.

> "Hm, wait. I do want my code to do something, somehow ? Not just throwing errors all over the place ?".   

Me too ! That's where it gets interesting. 

## Go touch some grass

First, let's talk about trees. 
In a typical programming language, before doing anything with a script, said script is usually translated in a much more practical form, called an _Abstract Syntactic Tree_ (or _AST_), and Micro is no exception to that.

Behind this daunting name hides a rather simple thing. Here's what it means. When you write `1+(2*3);`, for example, it's translated to something that roughly looks like `{ op: '+', args: [1, { op: '*', args: [2, 3] }] }`. It appears uglier, but it's now standard javascript and, as such, it's much nicer for a program to manipulate.

> The name comes from the fact you can represent it like so :

```
    +
   / \
  1   *
     / \
    2   3
```

> Which, if flipped, looks (somewhat, don't expect an computer scientist to know what nature is) like a tree.

That's exactly what our `parser` does : it reads the script, and just translates it into some shiny, good-looking `AST`, then hands it over to the `compiler`. But, for now, the compiler doesn't know what to do, since `Micro` is only a syntactic specification. Let's correct that.

> In fact, you will not see `AST`s that much, as they rather have to do with internal machinery and how languages, more broadly, work (but it's always good to know they exist !)

## The evaluator

In fact, our `MicroCompiler` takes more than just a parser to do its jobs. It also needs an `evaluator`, which you can pass like so :

```js
class DemoParser extends MicroParser { /* ... */ }

class DemoEvaluator extends MicroTransformer { /* ??? */ }

class DemoCompiler extends MicroCompiler {
    parser = new DemoParser()
    evaluator = new DemoEvaluator()
}
```

The `evaluator` is an object of type `MicroTransformer<T>`. Here's how you would build one :

```js
class DemoRunner extends MicroTransformer {
    lift: () => {}, // Don't worry about that for now
    reducer: ({$}, { body }) => { /* Actual logic goes here */ }
}
```

When you write and run a script, what actually happens is this :

* The parser reads it, checks it and generates an AST, representing the entire script.
* That AST gets passed to the evaluator. Here, you have the upper hand : you can do almost whatever you want with it.

The main component of an `evaluator` is its `reducer`, (also because, as we'll see, reducers are absolutely everywhere in Micro). A reducer is a simple function that takes in an `AST` and outputs a js object, which you can see as the result of processing that `AST` ; it reduces up the `AST` to an evaluated js value, hence the name. A `reducer` takes two arguments : a `context` (which we here directly pattern match to get its `$` attribute), and the `AST` to reduce (which we also pattern match to get its `body` field).

The most important thing here is `context`. It has three attributes (`$`, `operators` and `macros`), but we'll solely focus on `$` for now. `$` is a function that pretty much does all the job and allows to _evaluate_ `AST`s : it takes in an `AST`, no matter which one, and outputs a value of type `T` according to the semantics of you program. 

Suppose we just want to evaluate sequentially every expression inside your script. We would write :

```js
// We use pattern matching to fetch the $ field of the context, and the body field of the script AST
class DemoMicroRunner extends MicroTransformer {
    // ...

    reducer = ({$}, { body }) => {
        // See below for what `ops` and `macros` are here
        let ops = {}
        let macros = {}

        // body is a list of AST[] representing the statements of the script in order, 
        // so we iterate throught it to get every statement...
        for (let stmt of body) {
            // ...then evaluate said statement.
            $(stmt, ops, macros)
        }

        // There's no return value, meaning the script will return undefined
        // In the future, we might want to return some value (the result of processing the script)
    }
}
```

And we're done ! Well, almost. 

## Let's operate

Remember how I said that the Micro compiler has absolutely no idea about semantics ? That still holds. So how would it know that `+` adds two numbers and `*` multiplies them ?

By passing operators reducers (which are the implementation counterpart to the `OpDeclaration`s you passed to the parser) as the second argument to `$`, you implement the actual behavior of such operators.
Let's implement the `+`, for instance. The reducer is supposed to be a `(T[]) => T` function :

```js
class DemoRunner extends MicroTransformer {
    // ...

    // The operator reducer. It takes its arguments as a T[], i.e as an array of already evaluated js objects.
    private plusReducer = ([a,b]) => a+b
}
```

Now let's pass that operator in :

```js
class DemoMicroRunner extends MicroTransformer {
    // ...

    reducer = ({$}, { body }) => {
        // A piece of cake !
        // I'd like to remind you that due to JS'... peculiar design, implementing the reducer with a 
        // standard method rather than an arrow function would mean you have to write 
        // this.plusReducer.bind(this) instead.
        let ops = { "+": this.plusReducer }
        let macros = {}

        for (let stmt of body) {
            $(stmt, ops, macros)
        }
    }
}
```

> Notice how operators don't need to evaluate their arguments before adding them ? That's because the evaluator automatically `$`s any argument to an operator (as operators often do not care about the whereabouts of their operands, they just want to operate on the result of processing them). The reducer of an operator therefore takes a `T[]`, and not a `AST[]`.

You can now use `+` inside your scripts !

## More Micro Macros

There's still that ```let macros = {}``` line, which is later passed to `$` along with operators. What is it supposed to mean ? You might have guessed it, it's our macros implementation. I told you macros were a way to control how a block of code is executed, and  gave you the macro syntax :

```
macroName (arg1; ...; argn) {
    statement1;
    ...;
    statementn;
}
```

Internally, a macro is made up of two things : a `MacroDeclaration`, which we've already seen when building our parser and which tells what the macro syntactically looks like, and a `reducer` (of type `MacroReducer<T>`), which tells what the macro does. The latter works exactly like the script evaluator : it takes in a `context` and an `AST`, and must return a value of type `T`.

> It's no coincidence : macros are, in a sense, sub-scripts, or, to be more accurate, the script is just a big macro : the `evaluator`'s `reducer` is actually a `MacroReducer<T>` like the others !

When you ask the evaluator to evaluate an AST representing a macro via `$`, it searches up for the corresponding macro, and evaluates it by calling its reducer with the macro's own AST as an argument. The return type of the macro reducer is used as the return type of the whole macro expression. 

> "How am I supposed to manipulate that `AST` when writing my reducer ? Is there some helpers functions to retrieve data ?"

Well, no, but `AST`s really are simple folks. They're plain JS objects that have two (in fact, six, but we'll cover only the first two for now) fields, which are :

* `body` : We've already seen that one. It's the statements that form the body of the macro, as a list of `AST`.

* `head` : The arguments that were passed to the macro, also as a list of `AST`.

Back to the `macros` passed to `$`. To demonstrate what we just said, let's write a macro that acts like a JS `if` : it should evaluate its single argument, and evaluate its body only if it is truthy.

```js
// We declare the macro :

class DemoMicroParser extends MicroParser {
    operators = [...], // Operator declarations
    macros [{ name: "if", arity: 1 }], // Macro declarations

    //...
}

// Then, write its reducer

class DemoMicroRunner extends MicroTransformer {
    ifReducer = ({$}, { body, head }) => {
        // head here always has a length of 1 because of the arity check I mentionned in chapter 1
        let [condition] = head

        // If `condition` (which is an AST, so it needs to be evaluated) evaluates to true
        if ($(condition)) {
            // Evaluate body
            for (let expr of body) $(expr)
        }
    }
}
``` 

We need to pass it down just like `+` when evaluating things inside our evaluator :


```js
class DemoMicroRunner extends MicroTransformer {
    // ...
    private reducer({$}, { body }) {
        let ops = { "+": this.plusReducer }
        // Here's where the magic operates
        let macros = { "if": this.ifReducer }

        for (let expr of body) {
            // And there it goes, along with +
            $(expr, ops, macros)
        }
    }
}
```

We can then use it inside our script like this : 

```
#- This will evaluate -#
if (1) {
    1+1;
    2+2;
};

#- This won't  ! -#
if (0) {
    0+0;
}
```

And it will behave like a "real" if. Pretty neat, right ?

> I kind of lied. If you try to run the script above, you will get a weird error : `Unknown operator '#number'`. We'll solve that in a minute.

To summarize, the script is handed down to the global evaluator, which may, or may not, evaluate its statements using `$`. When evaluating an expression :
* If it's an operation, then it calls the according operator reducer with its arguments **already evaluated**. 
* If it's a macro, it calls the according macro reducer with its arguments **as unevaluated ASTs**. It is up to the macro to decide what to do with these.

And there's nothing more to know ! Micro scripts are exclusively constructed with operators and macros, which are then evaluated when needed.

> "But inside the `if` macro, `$` is called without any operators or macros passed down. Why ?"

This brings us to our next point : scopes.

## Scoping

This one is pretty simple : A macro inherits, inside of its body, any operators and macros that were already outside (we call these _ambient_ operators and macros). So that means that `if` doesn't need to pass again `+` and `if` as arguments to `$` since it's enclosed in the script, whose reducer already passes them, and that every operator/macro passed down by the evaluator is available globally. Every operator/macro passed to `$` inside the `if` reducer will be available in-script inside the `if` body, and inside it only.

If an operator/macro **that already exist outside** of the `if` is passed to `$`, that local implementation will override the ambient one (here again, inside the `if` body only).

Suppose now we have an operator, or macro, we defined outside, and that we want to slightly tweak its behavior. For example, we'd like to create a `verbose` macro that changes `+`'s behavior to printing out "Adding a and b !", and then return the result of adding `a` and `b`, to use like this :

```
verbose() {
    1+1; #- This should print "Adding 1 and 1 !" -#
}
```


We would do it like this :

```js
// Declaration
{ name: "verbose", arity: 1 }

// Reducer, to put in the DemoMicroRunner class body
verboseReducer = ({ $ },  { body }) => {
    // We override the regular behavior of +
    let localPlusOp = ([a,b]) => {
        console.log(`Adding ${a} and ${b} !`)
        return a+b
    }

    for (let expr of body) {
        $(expr, { "+": localPlusOp })
    }
}
```

While that may seem to work, there is a problem. If we nest an arbitrary number of `verbose` blocks one inside another, we might expect any `+` inside to print out that much "Adding a and b !". In fact, it won't, because the `+` that gets used is the `+` of the innermost `verbose` macro, that just prints it once. Luckily for us, the first `context` argument of macros has an `operators` field containing the reducers of the ambient operators. So we can change our implementation to this instead :

```js
private verboseReducer({ $, operators }, { body }) {
    let ambientPlusOp = operators["+"]
    let localPlusOp = ([a,b]) => {
        // We print, then we delegate to the ambient implementation. 
        // What this implementation actually does is none of our business ; but by
        // delegating, we won't interfere with the other macros.
        console.log(`Adding ${a} and ${b} !`)
        return ambientPlusOp([a, b])
    }

    for (let expr of body) {
        $(expr, { "+": localPlusOp })
    }
}
```

And it will work as intended. The `context` argument also has a `macros` field containing the ambient macros if you need them.

Generally speaking, it's a good practice to delegate operator implementation to the ambient operator if you don't know what to do with its values. That way, nested macros don't interfere with one another. Eventually, if no one knows what to do, it will be passed to the evaluator default operator implementation, that is, it will crash with the following message : "This use of operator op is illegal here.". Same for macros : better to delegate than to throw.

## Micro knows nothing about numbers

Let's solve the weird error about the `#number` operator we mentioned above. The title actually speaks for it : knowing what to do with numbers would be semantics, and Micro doesn't know anything about semantics !

Numbers in a Micro script are, in fact, syntactic sugar for a broader concept we've already shallowly seen : literals. 

> A literal don't have any equivalent in a script, so I'll use backticks (`) to write them, even if it's no actual syntax.

Literals are, like the name suggests, literal excerpts of the source code. They only exist as ASTs and have no direct in-script equivalent.

What happens when you write `1`, for instance, is that it implicitely generates an AST as if you applied operator `#number` to the literal ``` `1` ```. 

> Once again, you don't need to know how literals are actually represented as ASTs for now. All you need to know is that when you type `1`, an AST of this form is generated for you :
```
        #number
           |
          `1`
```


However, the literal \`1\` is, as you can see, an AST, and operators expect **evaluated ASTs** as arguments. It therefore mean we must be able to evaluate the literal before passing it to `#number` for it to actually produce a true number.

This is where the [lift function](#the-evaluator) we passed to the evaluator comes into play ! Every time a literal must be evaluated, the evaluator calls the lift function (which lifts, or promotes, the literal to a true value to be passed around) with a string, representing the literal, as its argument, and the result is understood as evaluating the literal.

Suppose we now want to actually implement numbers.
* We have to replace the dummy `_ => {}` lift function in our evaluator by a true lift function. Since lift takes a string representing a literal as an argument, and that evaluating a literal can, without too much imagination, return that same string, we'll just return the literal itself : `literal => literal`. So passing in \`1\` (as "1") will return "1".
* We have to implement the `#number` operator, which you will then have to pass to `$` along with `+`. We will juste parse that "1" to 1.0 with the JS `parseFloat` function.

```js
// Don't forget to declare '#number' with arity 1 to the 
// parser, and to pass down the numberReducer to $

// This will do for the implementation !
numberReducer = ([s]) => parseFloat(s)
```

And this will work just like you expected it to !

> While this may seem like overcomplicating things, this is a deliberate choice made to strictly enforce the syntax/semantics separation principle. Besides, it actually offers tangible benefits, because it allows for very fine-grained control over which literals are allowed and which ones aren't. If you wanted to ban floats, for example, you could just check the literal passed to `#number` doesn't contain a dot.

## Micro knows nothing about strings and names either

I think you got it : when Micro comes across a string, it calls the special operator `#string` with a literal representing the string (for "Hello world !", it would be \`Hello world !\`) as its sole operand.

Same goes with names, such as `foo` : the `#name` operator is called with \`foo\` as its only operand.

You can declare and implement the `#string` and `#name` operators depending on your needs ; without them, strings and names respectively are not usable inside your script.
