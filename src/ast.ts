import { MapLike } from "./util";

export type ASTMetadata = { fullSrc: string; src: string; loc: number; };
export type AST =
    { metadata: ASTMetadata; } &
    ({ type: "macro"; name: string; args: AST[]; body: AST[]; limbs: MapLike<AST[]>; } |
    { type: "operation"; operator: string; operands: AST[]; } |
    { type: "literal"; value: string; });
