import { RuntimePersistError } from './error.js'
import { Frame } from './frame.js'
import { Persistency } from './persistence.js'
import { CallableRegistry } from './registry.js'
import { Callable } from './types.js'

type CallableStateUpdate = (val: any) => any

export class CallableState extends Persistency {
	private state: Map<string, any>
	constructor(state: Record<string, any> | undefined) {
		super()
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

	persist(): any {
		const state: Record<string, any> = {}

		this.state.forEach((val, key) => {
			state[key] = val
		})

		return {
			schema: '0.0.1',
			kind: 'runtime.callable.state',
			data: {
				state: state,
			},
		}
	}

	static load(data: any): void {}
}

export class RuntimeState extends Persistency {
	private frame: Frame[]
	private executingFrame: Frame[]
	private waiting?: Frame

	private entrypoint?: Callable
	private callable: Map<string, Callable>
	private callableState: Map<string, CallableState>
	private registry: CallableRegistry
	private registryCleanup: () => void

	constructor(registry: CallableRegistry) {
		super()
		this.frame = []
		this.executingFrame = []
		this.entrypoint = undefined
		this.callable = new Map()
		this.callableState = new Map()
		this.waiting = undefined
		this.registry = registry
		this.registryCleanup = registry.on('add', (callable) => {
			this.onCallableRegister(callable)
		})

		this.initRegistrySetup()
	}

	private initRegistrySetup() {
		const callables = this.registry.all()

		callables.forEach((callable) => this.onCallableRegister(callable))
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
		this.registry.add(item)

		this.onCallableRegister(item)
	}

	getEntrypoint() {
		return this.entrypoint
	}

	getCallable(identifier: string) {
		return this.registry.get(identifier)
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

	persist(): any {
		const callableState: Record<string, any> = {}

		this.callableState.forEach((val, key) => {
			callableState[key] = val.persist()
		})

		return {
			schema: '0.0.1',
			kind: 'runtime.state',
			data: {
				frames: this.frame.map((f) => f.persist()),
				executingFrames: this.executingFrame.map((f) => f.persist()),
				entrypoint: this.entrypoint?.getIdentifier() || '',
				callableState: callableState,
			},
		}
	}

	static load(data: any): void {
		const rawFrames = data?.data?.frames

		if (!rawFrames) {
			throw new RuntimePersistError(
				`failed to load the config. key "frames" is missing from kind "runtime.state"`
			)
		}

		const frames = rawFrames?.map((m: any) => Frame.load(m))

		const rawExecutingFrames = data?.data?.executingFrames

		if (!rawExecutingFrames) {
			throw new RuntimePersistError(
				'failed to load the config. key "executingFrames" is missing from kind "runtime.state"'
			)
		}

		const executingFrames = rawExecutingFrames?.map((m: any) => Frame.load(m))

		const entrypoint = data?.data?.entrypoint

		const callbackState = data?.data?.callbackState

		if (!callbackState) {
			throw new RuntimePersistError(
				'failed to load the config. key "callableState" is missing from kind "runtime.state"'
			)
		}

		Object.keys(callbackState).forEach((key) => {
			const rawState = callbackState[key]

			const state = CallableState.load(rawState)
		})
	}
}
