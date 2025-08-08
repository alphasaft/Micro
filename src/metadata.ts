

/** Data relative to the Micro source code from which the object originates.
 * @field src - The integrality of the source code
 * @field span - The starting and ending points of the excerpt that produced the object.
 */
export type Metadata = { src: string; span: [number, number] };


/** Creates a new Metadata with the provided parameters. */
export function metadata(src: string, begin: number, end: number): Metadata {
    return {
        src,
        span: [begin, end]
    }
}

/** Returns the source code excerpt between `span[0]` and `span[1]` in `src`.  */
export function excerpt(m: Metadata) {
    let { src, span: [i,j] } = m
    return src.substring(i,j)
}


/** Returns a short string summarizing `m`, in the form "At (line, column) : code_excerpt" */
export function summarize(m: Metadata) {
    let { src, span: [i,j] } = m
    let lines = src.substring(0, i).split("\n")
    let lineNo = lines.length
    let columnNo = lines.at(-1)!.length+1
    let excerpt = src.substring(i,j)
    let maxLength = 50
    let shortExcerpt = 
        excerpt.includes('\n') ? excerpt.split('\n')[0] 
        : excerpt.length > maxLength ? excerpt.substring(0, maxLength) + " ..."
        : excerpt
        
    return `At (${lineNo}, ${columnNo}) : '${shortExcerpt}'`
}


