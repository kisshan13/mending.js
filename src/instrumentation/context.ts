import { AsyncLocalStorage } from "node:async_hooks"

export interface FrameContext {
    traceId: string
    frameId: string
    parentFrameId?: string
}

export class InstrumentationContext {
    private storage = new AsyncLocalStorage<FrameContext>()

    run<T>(context: FrameContext, callback: () => T): T {
        return this.storage.run(context, callback)
    }

    getStore() {
        return this.storage.getStore()
    }
}