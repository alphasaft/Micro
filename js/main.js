import { MicroCompiler } from "./Micro";
let example = new MicroCompiler(_ => { }, (args, body) => console.log(args, body), {
    "+": 10,
    "*": 20
});
example.compile(` 3*2+1 ; `, "yo");
//# sourceMappingURL=main.js.map