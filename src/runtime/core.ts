import { RuntimeCallableNotFound, RuntimeEntrypointError } from './error.js'
import { Frame } from './frame.js'
import { Callable, FrameResult } from './types.js'

type Status = 'idle' | 'running'

type ExecutionParams = any

export default class Runtime {
	private frame: Frame[]
	private executingFrame: Frame[]
	private status: Status
	private waiting?: Frame

	private entrypoint?: Callable

	private callable: Map<string, Callable>

	constructor() {
		this.frame = []
		this.executingFrame = []
		this.waiting = undefined
		this.status = 'idle'
		this.entrypoint = undefined
		this.callable = new Map()
	}

	setDefault(item: Callable) {
		this.entrypoint = item
	}

	register(item: Callable) {
		this.callable.set(item.getIdentifier(), item)
	}

	async getStatus() {
		return this.status
	}

	async execute(param: ExecutionParams): Promise<FrameResult> {
		if (!this.entrypoint) {
			throw new RuntimeEntrypointError(
				'no entrypoint callable defined for the runtime, use setDefault() function to set an entrypoint callable for the runtime'
			)
		}

		if (this.frame.length === 0) {
			this.frame.push(new Frame({ callable: this.entrypoint, params: param }))
		}

		const popped = this.frame.pop()

		if (!popped) {
			throw new RuntimeEntrypointError('no frame found')
		}

		this.executingFrame.push(popped)

		const result = await Promise.resolve(popped.call())

		if (result.type === 'spawn') {
			const spawnCallable = this.callable.get(result.spawnIdentifier)

			if (!spawnCallable) {
				throw new RuntimeCallableNotFound(
					`callable not found with identifier "${result.spawnIdentifier}". Spawning failed`
				)
			}

			this.frame.push(
				new Frame({ callable: spawnCallable, params: result.data })
			)

			return this.execute(result.data)
		}

		if (result.type === 'completed') {
			return this.onComplete(result)
		}

		if (result.type === 'wait') {
			this.waiting = popped

			return result
		}

		return result
	}

	private async onComplete(result: FrameResult): Promise<FrameResult> {
		this.executingFrame.pop()

		const anyParentFrame = this.executingFrame.pop()

		if (anyParentFrame) {
			anyParentFrame?.updateParam(result.data)

			this.frame.push(anyParentFrame)

			return this.execute(result.data)
		}

		return result
	}
}
