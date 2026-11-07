import { FrameMissingSpawnId } from './error.js'
import { Callable, FrameResult } from './types.js'
import { generateId } from './utils.js'

export class Frame {
    callable: Callable
    private params: any
    private id: string

    constructor({ callable, params }: { callable: Callable; params: any }) {
        this.callable = callable
        this.params = params
        this.id = generateId()
    }

    async call(): Promise<FrameResult> {
        const result = await Promise.resolve(this.callable.call(this.params))

        if (result.type === 'spawn' && !result?.spawnIdentifier) {
            throw new FrameMissingSpawnId(
                `Callable(${this.callable.getIdentifier()}) returns result of type "${result.type}" without any "spawnIdentifier" value`
            )
        }

        return {
            data: result.data,
            frameId: this.id,
            type: result.type,
            spawnIdentifier: result?.spawnIdentifier || ""
        }
    }

    getId() {
        return this.id
    }
}
