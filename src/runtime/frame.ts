import util from 'node:util'
import { FrameMissingSpawnId, RuntimePersistError } from './error.js'
import { Callable, FrameResult } from './types.js'
import { generateId } from './utils.js'
import { CallableState } from './state.js'
import { Persistency } from './persistence.js'
import { CallableRegistry } from './registry.js'

export class Frame extends Persistency {
	callable: Callable
	private params: any
	private id: string

	constructor({
		callable,
		params,
		id,
	}: {
		callable: Callable
		params: any
		id?: string
	}) {
		super()
		this.callable = callable
		this.params = params
		this.id = id || generateId()
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

	static load(data: any): Frame {
		const registry = data?.registry as CallableRegistry

		if (!registry || !(registry instanceof CallableRegistry)) {
			throw new RuntimePersistError(
				`failed to load the config. Frame requires the seralized data as {"registry": <CallableRegistry>, "data": "<persisted-seralized-data>"}. CallableRegistry is missing from the object passed to load() function.`
			)
		}

		const rawData = data?.data?.data

		if (!rawData?.id) {
			throw new RuntimePersistError(
				`failed to load the config. Frame requires the seralized data as {"registry": <CallableRegistry>, "data": "<persisted-seralized-data>"}. "id" is missing from the object passed to load() function.`
			)
		}

		if (!rawData?.callableId) {
			throw new RuntimePersistError(
				`failed to load the config. Frame requires the seralized data as {"registry": <CallableRegistry>, "data": "<persisted-seralized-data>"}. "data" field is missing from the object passed to load() function.`
			)
		}

		const callable = registry.get(rawData?.callableId)

		if (!callable) {
			throw new RuntimePersistError(
				`failed to load the config. Frame requires the seralized data as {"registry": <CallableRegistry>, "data": "<persisted-seralized-data>}. Callable not found for the frame.`
			)
		}

		return new Frame({
			callable: callable,
			params: rawData?.params,
			id: rawData?.id,
		})
	}

	[util.inspect.custom]() {
		return `Frame<callable=${this.callable.getIdentifier()}; id=${this.id} params=${this.params};>`
	}
}
