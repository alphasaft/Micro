export let between = (a: number, b: number, x: number) => a <= x && x <= b
export type MapLike<T> = { [key: string]: T; };

export function last<T>(arr: T[]): T {
    if (arr.length === 0) throw "Array is empty."
    return arr[arr.length-1]
}