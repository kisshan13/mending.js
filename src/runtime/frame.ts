import util from 'node:util'
import { FrameMissingSpawnId } from './error.js'
import { Callable, FrameResult } from './types.js'
import { generateId } from './utils.js'
import { CallableState } from './state.js'
import { Persistency } from './persistence.js'

export class Frame extends Persistency {
	callable: Callable
	private params: any
	private id: string

	constructor({ callable, params }: { callable: Callable; params: any }) {
		super()
		this.callable = callable
		this.params = params
		this.id = generateId()
	}

	async call(state: CallableState): Promise<FrameResult> {
		const result = await Promise.resolve(this.callable.call(this.params, state))

		if (result.type === 'spawn' && !result?.spawnIdentifier) {
			throw new FrameMissingSpawnId(
				`Callable(${this.callable.getIdentifier()}) returns result of type "${result.type}" without any "spawnIdentifier" value`
			)
		}

		return {
			data: result.data,
			frameId: this.id,
			type: result.type,
			spawnIdentifier: result?.spawnIdentifier || '',
		}
	}

	getId() {
		return this.id
	}

	updateParam(param: any) {
		this.params = param
	}

	persist(): any {
		return {
			schema: '0.0.1',
			kind: 'runtime.frame',
			data: {
				id: this.id,
				callableId: this.callable.getIdentifier(),
				params: this.params,
			},
		}
	}

	[util.inspect.custom]() {
		return `Frame<callable=${this.callable.getIdentifier()}; id=${this.id} params=${this.params};>`
	}
}
