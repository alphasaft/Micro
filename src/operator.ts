import { arity } from "./util"

export type OpDeclaration = { name: string, arity: arity }
// Implement legacy
export type OpReducer<T> = (args: T[]) => T