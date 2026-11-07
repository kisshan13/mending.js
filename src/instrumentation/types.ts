export type InstrumentationEventType =
    | 'frame:start'
    | 'frame:completed'
    | 'frame:error'

export interface InstrumentationEvent {
    type: InstrumentationEventType
    timestamp: number

    traceId: string
    frameId: string
    parentFrameId?: string
    callableId?: string

    data?: Record<string, any>
}