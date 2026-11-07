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

runtime.register({
	call: async () => {
		console.log('hii')
		return {
			type: 'completed',
			data: 'this is an example data',
		}
	},
	getIdentifier: () => 'hii',
})

runtime.setDefault({
	call: async () => {
		console.log('hello')
		return {
			type: 'spawn',
			data: 'hello',
			spawnIdentifier: 'hii',
		}
	},
	getIdentifier: () => 'hello',
})

const data = await context.run(
	{ runtimeId: 'runtime-001' },
	async () => await runtime.execute({ frameId: 'hello' })
)

console.log(data)

const events = collector.getEvents()

console.log(events)
