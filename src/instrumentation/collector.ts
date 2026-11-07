import { InstrumentationEvent } from './types.js'

export class EventCollector {
    private events: InstrumentationEvent[] = []

    push(event: InstrumentationEvent) {
        this.events.push(event)
    }

    getEvents() {
        return [...this.events]
    }
}