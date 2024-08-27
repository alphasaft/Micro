import { AST } from "./ast";
import { Context } from "./context";
import { arity, MapLike } from "./util";

export type MacroDeclaration = { name: string, arity: arity, limbs?: string[] }
export type MacroReducer<T> = (context: Context<T>, body: AST[], args: AST[], limbs: MapLike<AST[]>) => T
