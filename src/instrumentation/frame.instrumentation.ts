import { Frame } from '../runtime/frame.js'
import { InstrumentationContext } from './context.js'
import { EventCollector } from './collector.js'

export class FrameInstrumentation {
    constructor(
        private context: InstrumentationContext,
        private collector: EventCollector
    ) { }

    install() {
        const original = Frame.prototype.call

        const instrumentation = this

        Frame.prototype.call = async function (...args: any[]) {
            const current = instrumentation.context.getStore()

            if (!current) {
                return original.apply(this, args)
            }

            instrumentation.collector.push({
                type: 'frame:start',
                timestamp: Date.now(),
                frameId: this.getId(),
                callableId: this.callable.getIdentifier(),
                ...current
            })

            try {
                const result = await original.apply(this, args)

                instrumentation.collector.push({
                    type: 'frame:completed',
                    timestamp: Date.now(),
                    frameId: this.getId(),
                    callableId: this.callable.getIdentifier(),
                    ...current
                })

                return result
            } catch (error) {
                instrumentation.collector.push({
                    type: 'frame:error',
                    timestamp: Date.now(),
                    frameId: this.getId(),
                    callableId: this.callable.getIdentifier(),
                    ...current,
                    data: {
                        error: String(error)
                    }
                })

                throw error
            }
        }
    }
}