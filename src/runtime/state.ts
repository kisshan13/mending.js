import { Frame } from "./frame.js";
import { Callable } from "./types.js";

export class RuntimeState {
    private frame: Frame[]
    private executingFrame: Frame[]

    private entrypoint?: Callable

    constructor() {
    }
}