import { arity } from "./util"

export type OpDeclaration = { name: string, arity: arity }
export type OpReducer<T> = (args: T[]) => T