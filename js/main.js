import { ITACompiler } from "./ITA";
let example = new ITACompiler(_ => { }, (args, body) => console.log(args, body), {
    "+": 10,
    "*": 20
});
example.compile(` 3*2+1 ; `, "yo");
//# sourceMappingURL=main.js.map