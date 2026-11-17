import { Callable, CallableRegistry, Runtime } from '../dist/index.js'
import {
	EventCollector,
	FrameInstrumentation,
	InstrumentationContext,
} from '../dist/instrumentation/index.js'

const registry = new CallableRegistry()

const worker = new Callable('worker', async ({ data, complete }) => {
	return complete({ result: data.value * 2 })
})

const orchestrator = new Callable(
	'orchestrator',
	async ({ data, state, spawn, complete }) => {
		if (!state.get('workerStarted')) {
			state.set('workerStarted', () => true)
			return spawn(data, worker)
		}

		return complete({ result: data.result })
	},
	{ workerStarted: false }
)

const registryContext = new InstrumentationContext()
const collector = new EventCollector()
const instrumentation = new FrameInstrumentation(registryContext, collector)
instrumentation.install()

const runtime = new Runtime({ registry })
runtime.register(worker)
runtime.setDefault(orchestrator)

const result = await registryContext.run(
	{ traceId: 'trace-1', frameId: 'runtime-entry' },
	() => runtime.execute({ value: 21 })
)

console.log(result.type)
console.log(result.data)
console.log(
	collector.getEvents().map(({ type, callableId }) => ({ type, callableId }))
)
