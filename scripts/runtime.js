import { Runtime } from '../dist/index.js'

import {
	EventCollector,
	FrameInstrumentation,
	InstrumentationContext,
} from '../dist/instrumentation/index.js'

const context = new InstrumentationContext()
const collector = new EventCollector()

const frameInstrumentation = new FrameInstrumentation(context, collector)

frameInstrumentation.install()

const runtime = new Runtime()

let firstExecution = 0
let secondExecution = 0

runtime.register({
	call: async (data) => {
		console.log(2)
		if (secondExecution == 1) {
			return {
				type: 'completed',
				data: data,
			}
		}

		secondExecution += 1

		return {
			type: 'spawn',
			data: 'Identifier 2',
			spawnIdentifier: '3',
		}
	},
	getIdentifier: () => '2',
})

runtime.register({
	call: async () => {
		console.log('3')
		return {
			type: 'completed',
			data: 'Identifier 3',
		}
	},
	getIdentifier: () => '3',
})

runtime.setDefault({
	call: async (data) => {
		console.log(1)
		if (firstExecution == 1) {
			return {
				type: 'completed',
				data: data,
			}
		}

		firstExecution += 1

		return {
			type: 'spawn',
			data: 'Identifier 1',
			spawnIdentifier: '2',
		}
	},
	getIdentifier: () => '1',
})

// const data = await runtime.execute({ frameId: 'hello' })

// console.log(data)

const data = await context.run(
	{ runtimeId: 'runtime-001' },
	async () => await runtime.execute({ frameId: 'hello' })
)

console.log(data)

const events = collector.getEvents()

// console.log(events)
