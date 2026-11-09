import { CallableState } from './state.js'

export interface Callable {
	getIdentifier: () => string
	call: (data: any, state: CallableState) => Promise<CallableResult>
	getBaseState: () => Record<string, any> | undefined
}

export type FrameResultType = 'wait' | 'spawn' | 'completed'
export type CallableResultType = FrameResultType

export interface FrameResult {
	type: FrameResultType
	frameId: string
	data: any
	spawnIdentifier: string
}

export interface CallableResult {
	type: CallableResultType
	data: any
	spawnIdentifier?: string
}
