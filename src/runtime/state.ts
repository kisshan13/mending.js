import { Frame } from './frame.js'
import { Callable } from './types.js'

type CallableStateUpdate = (val: any) => any

export class CallableState {
	private state: Map<string, any>
	constructor(state: Record<string, any> | undefined) {
		this.state = new Map()

		if (state) {
			Object.keys(state).forEach((key) => {
				const val = state[key]

				this.state.set(key, val)
			})
		}
	}

	get(key: string) {
		return this.state.get(key)
	}

	set(key: string, callback: CallableStateUpdate) {
		const currentState = this.state.get(key)

		this.state.set(key, callback(currentState))
	}
}

export class RuntimeState {
	private frame: Frame[]
	private executingFrame: Frame[]
	private waiting?: Frame

	private entrypoint?: Callable
	private callable: Map<string, Callable>
	private callableState: Map<string, CallableState>

	constructor() {
		this.frame = []
		this.executingFrame = []
		this.entrypoint = undefined
		this.callable = new Map()
		this.callableState = new Map()
		this.waiting = undefined
	}

	frameCount() {
		return this.frame.length
	}

	push(frame: Frame, type: 'normal' | 'execute') {
		if (type === 'execute') {
			this.executingFrame.push(frame)
		}

		this.frame.push(frame)
	}

	pop(type: 'normal' | 'execute') {
		if (type === 'execute') {
			return this.executingFrame.pop()
		}

		return this.frame.pop()
	}

	setDefault(item: Callable) {
		this.entrypoint = item

		this.register(item)
	}

	register(item: Callable) {
		this.callable.set(item.getIdentifier(), item)
		this.onCallableRegister(item)
	}

	getEntrypoint() {
		return this.entrypoint
	}

	getCallable(identifier: string) {
		return this.callable.get(identifier)
	}

	setWaiting(frame?: Frame) {
		this.waiting = frame
	}

	getWaiting() {
		return this.waiting
	}

	getCallableState(callable: Callable): CallableState {
		const isStateExists = this.callableState.get(callable.getIdentifier())

		if (!isStateExists) {
			this.callableState.set(
				callable.getIdentifier(),
				new CallableState(callable.getBaseState())
			)

			return this.callableState.get(callable.getIdentifier())!
		}

		return this.callableState.get(callable.getIdentifier())!
	}

	private onCallableRegister(callable: Callable) {
		const identifier = callable.getIdentifier()

		const isStateExists = this.callableState.get(identifier)

		if (isStateExists) {
			return
		}

		this.callableState.set(
			identifier,
			new CallableState(callable.getBaseState())
		)
	}
}
