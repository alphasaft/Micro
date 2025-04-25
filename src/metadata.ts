

/** Data relative to the Micro source code from which the object originates.
 * @field src - The integrality of the source code
 * @field span - The starting and ending points of the excerpt that yielded the object.
 */
export type Metadata = { src: string; span: [number, number] };

/** Returns the source code excerpt between `span[0]` and `span[1]` in `src`.  */
export function excerpt(m: Metadata) {
    let { src, span: [i,j] } = m
    return src.substring(i,j)
}

/**
 * Throws an error message with a header summarizing the metadata
 * @param msg The error message to display
 * @param metadata The metadata that will be summarized
 */
export function throwWith(metadata: Metadata, msg: string): never {
    let { src, span: [i,j] } = metadata
    let lines = src.substring(0, i).split("\n")
    let lineNo = lines.length
    let columnNo = lines.at(-1)!.length+1
    let excerpt = src.substring(i,j)
    let shortExcerpt = 
        excerpt.includes('\n') ? excerpt.split('\n')[0] 
        : excerpt.length <= 30 ? excerpt 
        : excerpt.substring(0, 30) + " ..."
        
    throw `At (${lineNo}, ${columnNo}) : '${shortExcerpt}' : \n ${msg}`
}
