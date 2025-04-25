export let between = (a: number, b: number, x: number) => a <= x && x <= b
export let range = (n: number) => { let r = []; for (let i=0;i<n;i++) r.push(i) ; return r }

export type rangeArity = [number, number]
export type arity = number | rangeArity;
export let toRangeArity = (n: arity): rangeArity => typeof n === "number" ? [n,n] : n
export let any: arity = [0, Infinity]
export let oneOrMore: arity = [1, Infinity]
export let twoOrMore: arity = [2, Infinity]

export type Dictionary<T> = { [key: string]: T; };

