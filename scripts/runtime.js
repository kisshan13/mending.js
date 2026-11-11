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

let firstExecution = 0
let secondExecution = 0

const thirdCallable = new Callable('3', async (ctx) => {
	console.log('3')
	return ctx.complete('Identifier 3')
})

const secondCallable = new Callable('2', async (ctx) => {
	console.log(2)
	if (secondExecution == 0) {
		secondExecution += 1
		return ctx.wait('need information')
	}

	if (secondExecution == 2) {
		return ctx.complete(ctx.data)
	}

	secondExecution += 1

	return ctx.spawn('Identifier 2', thirdCallable)
})

const baseCallable = new Callable('1', async (ctx) => {
	console.log(1)
	if (firstExecution == 1) {
		return ctx.complete({ data: ctx.data })
	}

	firstExecution += 1

	return ctx.spawn('Identifier 1', secondCallable)
})

registry.add(baseCallable, secondCallable, thirdCallable)

const runtime = new Runtime({ registry: registry })

runtime.register(secondCallable)
runtime.register(thirdCallable)
runtime.setDefault(baseCallable)

// const data = await runtime.execute({ frameId: 'hello' })

// console.log(data)

const data = await context.run(
	{ runtimeId: 'runtime-001' },
	async () => await runtime.execute({ frameId: 'hello' })
)

console.log(data)

const moreData = await context.run(
	{
		runtimeId: 'runtime-001',
	},
	async () => await runtime.execute({ frameId: 'hello' })
)

console.log(moreData)

const events = collector.getEvents()

// console.log(events)
