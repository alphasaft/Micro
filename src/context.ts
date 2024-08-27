import { Evaluator } from "./evaluator"
import { MacroReducer } from "./macro"
import { OpReducer } from "./operator"
import { MapLike } from "./util"

export type Context<T> = {
    ev: Evaluator<T>,
    operators: MapLike<OpReducer<T>>,
    macros: MapLike<MacroReducer<T>>,
}