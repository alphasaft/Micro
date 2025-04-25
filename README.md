# What is Micro ?

There is two schools when coming to data storing format. The first one is to use already available formats like `XML` or `json`. This allows to use already written, highly optimized parsers, sparing lots of time for the programmer, while having to comply with a preexisting format that is not always adapted to the needs of the codebase. The second one is to write a parser yourself, with tools like `ANTLR` or `APG`. While boasting high expressivity and customizable options, they are pretty complex tools that take time to master. 

Micro aims at finding a middle ground between those two solutions : while having a preexisting syntax that avoids you the annoyance of writing a parser from the ground, said syntax was thought out to be sufficiently versatile to allow almost anything you could think of. It does not seek to to parse preexisting format ; rather, it is meant to describe data in an elegant way, without twisting its shape to fit preexisting, rigid formats.

For example, suppose you want to write an app managing todolists. Here's how you could implement data storage in json : 

> tasks.json

```
[
    { 
        name: "holidays", 
        tasks: [
            { name: "key", desc: Take the key", severity: "critical" },
            { name: "clothing", desc: "Add T-shirts", severity: "mild" }
        ]
    },
    { 
        name: "home",
        tasks: [ 
            { name: "room", desc: "Clean the room", severity: "mild" },
            { name: "mow", desc: "Speaks for it", severity: "critical" }
        ]
    }
]
```

But that's pretty heavy. Much of the characters used are actually only syntactic, carrying no meaning, and the structure and intent of the data is not very clear to grasp. On the other hand, here's a small Micro Script expressing exactly the same thing :

> tasks.mc

```
tasklist (holiday) {
    #critical "key" : "Take the key";
    #mild "clothing" : "Add T-shirts";
};

tasklist (home) {
    #mild "room" : "Clean the room";
    #critical "mow" : "Speaks for it";
}
```

Which is far more clear and compact. Micro also allows to pack in logic. For example, if we want to add our holiday tasklist only if the holidays are approching, we could write :

> tasks.mc

```
if (15/06/2025 <= [#today] <= 01/06/2025) {
    tasklist (holiday) {
        #critical "key" : "Take the key";
        #mild "clothing" : "Add T-shirts";
    }
};

tasklist (home) {
    #mild "room" : "Clean the room";
    #critical "mow" : "Speaks for it";
}
```

Micro really shines whenever there is a need for an external user to write or read data, because it allows for far more user-friendly, maintainable formats, while retaining every data-related specifities.
