import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const worker = new Callable('worker', async (ctx) => {
	console.log('Worker input:', ctx.data)

	return ctx.complete({
		message: 'Worker completed successfully',
		processed: ctx.data.value * 2,
	})
})

const orchestrator = new Callable(
	'orchestrator',
	async (ctx) => {
		if (!ctx.state.get('workerSpawned')) {
			ctx.state.set('workerSpawned', () => true)
			return ctx.spawn({ value: ctx.data.value }, worker)
		}

		return ctx.complete({
			message: 'Orchestration completed',
			workerResult: ctx.data,
		})
	},
	{ workerSpawned: false }
)

const registry = new CallableRegistry()
const runtime = new Runtime({ registry })

runtime.register(worker)
runtime.setDefault(orchestrator)

const result = await runtime.execute({ value: 21 })
console.log(result.type)
console.log(result.data.workerResult.processed)
