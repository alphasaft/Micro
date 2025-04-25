export let between = (a: number, b: number, x: number) => a <= x && x <= b
export let range = (n: number) => { let r = []; for (let i=0;i<n;i++) r.push(i) ; return r }
export type Dictionary<T> = { [key: string]: T; };

