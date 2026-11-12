import { Callable } from './callable.js'
import {
	RuntimeCallableNotFound,
	RuntimeEntrypointError,
	RuntimePersistError,
} from './error.js'
import { Frame } from './frame.js'
import { Persistency } from './persistence.js'
import { CallableRegistry } from './registry.js'
import { RuntimeState } from './state.js'
import { FrameResult } from './types.js'

export type Status = 'idle' | 'running'

export type ExecutionParams = any

export interface RuntimeOpts {
	state?: RuntimeState
	registry: CallableRegistry
}

export default class Runtime extends Persistency {
	private status: Status

	private state: RuntimeState

	constructor(opts: RuntimeOpts) {
		super()
		this.status = 'idle'
		this.state = opts?.state ?? new RuntimeState(opts.registry)
	}

	setDefault(item: Callable) {
		this.state.setDefault(item)
	}

	register(item: Callable) {
		this.state.register(item)
	}

	async getStatus() {
		return this.status
	}

	async execute(param: ExecutionParams): Promise<FrameResult> {
		const entrypoint = this.state.getEntrypoint()

		if (!entrypoint) {
			throw new RuntimeEntrypointError(
				'no entrypoint callable defined for the runtime, use setDefault() function to set an entrypoint callable for the runtime'
			)
		}

		const anyWaiting = this.state.getWaiting()

		if (anyWaiting) {
			anyWaiting.updateParam(param)

			this.state.push(anyWaiting, 'normal')
			this.state.setWaiting(undefined)

			return this.execute(param)
		}

		if (this.state.frameCount() === 0) {
			this.state.push(
				new Frame({ callable: entrypoint, params: param }),
				'normal'
			)
		}

		const popped = this.state.pop('normal')

		if (!popped) {
			throw new RuntimeEntrypointError('no frame found')
		}

		this.state.push(popped, 'execute')

		const result = await Promise.resolve(
			popped.call(this.state.getCallableState(popped.callable))
		)

		if (result.type === 'spawn') {
			const spawnCallable = this.state.getCallable(result?.spawnIdentifier)

			if (!spawnCallable) {
				throw new RuntimeCallableNotFound(
					`callable not found with identifier "${result.spawnIdentifier}". Spawning failed`
				)
			}

			this.state.push(
				new Frame({ callable: spawnCallable, params: result.data }),
				'normal'
			)

			return this.execute(result.data)
		}

		if (result.type === 'completed') {
			return this.onComplete(result)
		}

		if (result.type === 'wait') {
			return this.onWait(result)
		}

		return result
	}

	private async onWait(result: FrameResult): Promise<FrameResult> {
		const poppedExecution = this.state.pop('execute')

		this.state.setWaiting(poppedExecution)

		return result
	}

	private async onComplete(result: FrameResult): Promise<FrameResult> {
		this.state.pop('execute')

		const anyParentFrame = this.state.pop('execute')

		if (anyParentFrame) {
			anyParentFrame?.updateParam(result.data)

			this.state.push(anyParentFrame, 'normal')

			return this.execute(result.data)
		}

		return result
	}

	persist(): any {
		return {
			schema: '0.0.1',
			kind: 'runtime',
			data: { state: this.state.persist() },
		}
	}

	shutdown() {
		this.state.shutdown()
	}

	static load(data: any): Runtime {
		const registry = data?.registry as CallableRegistry

		if (!registry || !(registry instanceof CallableRegistry)) {
			throw new RuntimePersistError(
				`failed to load the config. Runtime requires the seralized data as {"registry": <CallableRegistry>, "data": "<persisted-seralized-data>"}. CallableRegistry is missing from the object passed to load() function.`
			)
		}

		const rawData = data?.data

		const rawState = rawData?.data?.state

		if (!rawState) {
			throw new RuntimePersistError(
				`failed to load the config. key "state" is missing from kind "runtime"`
			)
		}

		const runtimeState = RuntimeState.load({
			registry: registry,
			data: rawState,
		})

		const runtime = new Runtime({ registry: registry, state: runtimeState })

		return runtime
	}
}
