import { AST } from "./ast";
import { MacroReducer } from "./macro";
import { OpReducer } from "./operator";
import { MapLike } from "./util";

export type Evaluator<T> = (
    ast: AST, 
    operators?: MapLike<OpReducer<T>>, 
    macros?: MapLike<MacroReducer<T>>
) => T
