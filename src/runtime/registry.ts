import { Callable } from './types.js'
import { generateId } from './utils.js'

type CallableRegistryCallback = (callable: Callable) => void

export class CallableRegistry {
	private registry: Map<string, Callable>
	private listeners: Map<string, CallableRegistryCallback>

	constructor() {
		this.registry = new Map()
		this.listeners = new Map()
	}

	add(...callables: Callable[]) {
		for (const callable of callables) {
			const isExists = this.registry.get(callable.getIdentifier())

			if (!isExists) {
				this.registry.set(callable.getIdentifier(), callable)
				this.emit('add', callable)
			}
		}
	}

	all(): Callable[] {
		const callables: Callable[] = []

		this.registry.forEach((v) => callables.push(v))

		return callables
	}

	remove(callable: Callable) {
		if (this.registry.delete(callable.getIdentifier())) {
			this.emit('remove', callable)
		}
	}

	get(identifier: string) {
		return this.registry.get(identifier)
	}

	on(event: 'add' | 'remove', callback: CallableRegistryCallback) {
		const id = generateId()

		this.listeners.set(`${id}:${event}`, callback)

		return () => {
			this.listeners.delete(id)
		}
	}

	// Needs optimization currently very poorly implemented
	emit(event: 'add' | 'remove', callable: Callable) {
		this.listeners.forEach((val, key) => {
			if (key.endsWith(event)) {
				val(callable)
			}
		})
	}
}
