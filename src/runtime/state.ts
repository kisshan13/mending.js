import { Frame } from './frame.js'
import { Callable } from './types.js'

export class RuntimeState {
	private frame: Frame[]
	private executingFrame: Frame[]
	private waiting?: Frame

	private entrypoint?: Callable
	private callable: Map<string, Callable>

	constructor() {
		this.frame = []
		this.executingFrame = []
		this.entrypoint = undefined
		this.callable = new Map()
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
	}

	register(item: Callable) {
		this.callable.set(item.getIdentifier(), item)
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
}
