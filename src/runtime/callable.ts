import { CallableResult } from './types.js'

interface CallableContext {
	wait: (data: any) => CallableResult
	complete: (data: any) => CallableResult
	spawn: (data: any, callable: Callable) => CallableResult
	data: any
}

type CallableFn = (ctx: CallableContext) => Promise<CallableResult>

export class Callable {
	private identifier: string
	private execute: CallableFn

	constructor(identifier: string, execute: CallableFn) {
		this.identifier = identifier
		this.execute = execute
	}

	getIdentifier() {
		return this.identifier
	}

	async call(...args: any): Promise<CallableResult> {
		return this.execute({
			complete: Callable.complete,
			spawn: Callable.spawn,
			wait: Callable.wait,
			data: args,
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
