import { CallableState } from './state.js'
import { CallableResult } from './types.js'

interface CallableContext {
	wait: (data: any) => CallableResult
	complete: (data: any) => CallableResult
	spawn: (data: any, callable: Callable) => CallableResult
	data: any
	state: CallableState
}

type CallableFn = (ctx: CallableContext) => Promise<CallableResult>

export class Callable {
	private identifier: string
	private execute: CallableFn
	private baseState?: Record<string, any>

	constructor(
		identifier: string,
		execute: CallableFn,
		baseState?: Record<string, any>
	) {
		this.identifier = identifier
		this.execute = execute
		this.baseState = baseState
	}

	getIdentifier() {
		return this.identifier
	}

	getBaseState(): Record<string, any> | undefined {
		return this.baseState
	}

	async call(data: any, state: CallableState): Promise<CallableResult> {
		return this.execute({
			complete: Callable.complete,
			spawn: Callable.spawn,
			wait: Callable.wait,
			data: data,
			state: state,
		})
	}

	static wait(data: any): CallableResult {
		return {
			type: 'wait',
			data: data,
		}
	}

	static complete(data: any): CallableResult {
		return {
			type: 'completed',
			data: data,
		}
	}

	static spawn(data: any, callable: Callable): CallableResult {
		return {
			type: 'spawn',
			data: data,
			spawnIdentifier: callable.getIdentifier(),
		}
	}
}

export class CallableRegistry {
	private registry: Map<string, Callable>

	constructor() {
		this.registry = new Map()
	}

	add(...callables: Callable[]) {
		for (const callable of callables) {
			this.registry.set(callable.getIdentifier(), callable)
		}
	}

	remove(callable: Callable) {
		this.registry.delete(callable.getIdentifier())
	}

	get(identifier: string) {
		return this.registry.get(identifier)
	}
}
