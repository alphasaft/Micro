# What is Micro ?

There is two schools when coming to designing a domain-specific language (DSL) for a specific purpose. The first one is to write it inside the language you're using. This allows to use already written, highly optimized parsers, sparing lots of time for the programmer, while having to comply with a preexisting format that is not always adapted to the needs of the codebase. The second one is to write a parser yourself, with tools like `ANTLR` or `APG`. While boasting high expressivity and customizable options, they are pretty complex tools that take time to master. 

Micro aims at finding a middle ground between those two solutions : while having a preexisting syntax that avoids you the annoyance of writing a parser from the ground, said syntax was thought out to be sufficiently versatile to allow almost anything you could think of. It does not seek to to parse preexisting formats ; rather, it is meant to describe some kind of logic or data in an elegant way, without twisting its shape to fit the rigid syntax of a specific language. 

For instance, suppose you want to design a grep-like command line interface interoperable with JS. Here's how it might look like if you tried to implement in pure JS :

```js
let command = new Command("mygrep");

let regexparg = command.newArgument("<regexp>")
regexparg.setDesc("The regexp to search for.")
regexparg.setExpectedType(REGULAR_EXPRESSION)

let fileOption = command.newOption("-f", "--file")
fileOption.setDesc("Searches in a file for the provided regexp.")
fileOption.setExpectedType(FILE_NAME)

let inlineOption = command.newOption("-i", "--inline")
inlineOption.setDesc("Searches in a string for the provided regexp.")
inlineOption.setExpectedType(STRING)

let debugOption = command.newOption("--debug")
debugOption.setDesc("Enters debug mode.")
debugOption.setExpectedType(NONE)

command.bind(myGrepCallback)

// And so on for each command

```

While here's a Micro script that could describe that :

```
external myGrepCallback from js;


command mygrep calling myGrepCallback {
    argument ("<regexp>") {
        #expectedvaluetype regexp;
        #desc "The regexp to search for";
    }

    option (-f; --file) {
        #expectedvaluetype filename;
        #desc "Searches in a file for the provided regexp.";
    }

    option (--inline) {
        #expectedvaluetype string;
        #desc "Searches in a string for the provided regexp.";
    }

    option (--debug) {
        #expectedvaluetype none;
        #desc "Enters debug mode."
    }
} 
```

Easily readable, concise and clear, while also decoupled from the actual javascript implementation. Micro really shines whenever there is a need for an external user to write or read your code, because it allows for far more user-friendly, maintainable formats, while retaining every framework-related specifities. To get a glance of Micro's syntax, read the syntax reference in `docs/syntax.md`, and then the `docs/handbook.md` to get started !