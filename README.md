# What is Micro ?

There is two schools when coming to designing a domain-specific language (DSL) for a specific purpose. 

The first one is to write it inside the language you're using, i.e to write your class/methods/functions is such a way that writing code that uses them feels pretty natural, often resulting in english-y sentences. This allows to use the already written, highly optimized language parser, sparing lots of time for the programmer ; the downside is having to comply with a preexisting format that is not always adapted to the needs of the codebase. 

The second one is pretty much this opposite, i.e to write a parser yourself. Solutions like `ANTLR` or `APG` are one way to do so, yet while boasting high expressivity and customizable options they are pretty complex tools that take time to master, not even mentionning the shenanigans that can arise when trying to understand how to make `1+2*3` be read as `1+(2*3)` and not as `(1+2)*3`. 

Micro aims at finding a middle ground between those two solutions : while having a preexisting syntax that avoids you the annoyance of writing a parser from the ground, said syntax was thought out to be sufficiently versatile to allow almost anything you could think of. It does not seek to to parse preexisting formats ; rather, it is meant to create DSLs (Domain Specific Language) to express some kind of logic or data in an elegant way, without twisting its shape.
