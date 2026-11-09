export interface Callable {
	getIdentifier: () => string
	call: (...args: any) => Promise<CallableResult>
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