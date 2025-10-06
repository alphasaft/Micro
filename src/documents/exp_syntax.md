# Micro Syntax Reference

As explained in the `api.md` file, the Micro library consist of a parser to read certain scripts and then output them as ASTs :

```
1+1                 -> Op { '+', [1,1] }
if (true) { "hi" }  -> Macro { 'if', true, "hi" }
```

Then, using Micro, you can specify the appropriate behavior for each of such structures. Given the fact, as we'll see, everything in a Micro script boils down to operators and macros, this allows to define a wide range of structures while keeping the backing javascript API simple. This syntax reference aims at exploring the different possibilities that are at your disposal when designing a DSL with the Micro framework.
