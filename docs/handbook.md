# Micro

Micro is a small library for creating, parsing and interpreting languages fitting your requirements in a matter of minutes. Micro scripts are all based on the same generic yet very polymorpheous syntax that you can adapt to your situation ; it then allows you to quickly parse that language to generate usable JS values out of it. It aims at adressing the need for user-friendly, highly domain specific languages (DSLs), where using javascript or another mainstream language would lead to a lot of boilerplate and/or obfuscated code. 

The tool itself is written in Typescript, but knowing Javascript is, as per Typescript's design, sufficient to use it (you can learn Javascript [here](https://www.learn-js.org/)). I will sometimes use Typescript syntax to describe what types are expected, but as you'll see it's pretty simple to understand what I mean.


## Principle

The way Micro works is pretty straightforward :
1. You declare the operators and macros that will be usable in your scripts
2. You implement said operators and macros as reducers.


### Operator & macro declarations


