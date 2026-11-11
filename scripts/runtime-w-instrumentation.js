import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

import {
	EventCollector,
	FrameInstrumentation,
	InstrumentationContext,
} from '../dist/instrumentation/index.js'

const context = new InstrumentationContext()
const collector = new EventCollector()

const frameInstrumentation = new FrameInstrumentation(context, collector)

frameInstrumentation.install()

const registry = new CallableRegistry()

const secondaryCallable = new Callable('hii', async (ctx) => {
	console.log('hii')
	return ctx.complete('this is an example data')
})

const baseCallable = new Callable('hello', async (ctx) => {
	console.log('hello')
	return ctx.wait('hello')
})

registry.add(secondaryCallable, baseCallable)

const runtime = new Runtime({ registry: registry })

runtime.register(secondaryCallable)

runtime.setDefault(baseCallable)

const data = await context.run(
	{ runtimeId: 'runtime-001' },
	async () => await runtime.execute({ frameId: 'hello' })
)

console.log(data)

const events = collector.getEvents()

console.log(events)
